// Logika inti pengecekan status pesanan OTP ke RumahOTP + efek sampingnya
// (auto-refund kalau kedaluwarsa/dibatalkan, kasih poin kalau sukses).
// Dipisah dari app/api/otp/status/route.js supaya bisa dipakai juga oleh cron
// pembersihan (lib/cleanup.js) untuk merekonsiliasi pesanan "pending" yang macet
// karena user tidak pernah membuka lagi halaman statusnya.
import { otpOrdersCol, usersCol } from "@/lib/db";
import { checkOrderStatus } from "@/lib/rumahotp";
import { getApiKeys } from "@/lib/apiKeys";
import { sendTelegramNotif, otpReceivedNotif, otpAutoRefundNotif } from "@/lib/telegram";
import { awardTransactionPoints } from "@/lib/loyalty";
import { logBalance } from "@/lib/ledger";

const KNOWN_TERMINAL = ["canceled", "cancelled", "expired", "refund", "refunded"];

function extractCode(d) {
  if (!d) return null;
  const isPlaceholder = (v) => {
    const s = String(v).trim();
    return s === "" || s === "-" || s === "--" || s === "—" || s.toLowerCase() === "null";
  };
  const directFields = ["otp_code", "code", "sms_code", "otpCode", "full_sms", "verification_code"];
  for (const f of directFields) {
    if (d[f] !== undefined && d[f] !== null && !isPlaceholder(d[f])) return String(d[f]).trim();
  }
  const textFields = ["sms", "message", "sms_text", "full_sms_text", "text"];
  for (const f of textFields) {
    const text = d[f];
    if (typeof text === "string" && text.trim() && !isPlaceholder(text)) {
      const match = text.match(/\b\d{3,8}\b/);
      if (match) return match[0];
    }
  }
  return null;
}

// Mengecek ulang satu pesanan ke provider lalu menerapkan semua efek samping yang
// relevan (update status, auto-refund, poin loyalitas, notif). Aman dipanggil
// berkali-kali untuk pesanan yang sama — refund & poin masing-masing diklaim atomik.
export async function reconcileOtpOrder(order) {
  const orders = await otpOrdersCol();

  // Pesanan yang sudah final tidak perlu ditanyakan lagi ke provider. Khusus pesanan
  // yang sudah di-refund, kode OTP yang telat masuk TIDAK boleh ditampilkan
  // (user sudah menerima uangnya kembali).
  if (order.refunded || order.status === "done") {
    return {
      resolvedStatus: order.status,
      otpCode: order.refunded ? null : order.otpCode,
      otpMsg: order.refunded ? null : order.otpMsg,
      refunded: false,
      newBalance: undefined,
      pointsEarned: 0
    };
  }
  const { rumahOtp } = await getApiKeys();
  const result = await checkOrderStatus(rumahOtp, order.orderId);
  const data = result.data || result;

  const extractedCode = extractCode(data);
  const newOtpCode = extractedCode || order.otpCode;
  const otpJustArrived = !order.otpCode && !!newOtpCode;

  const providerStatus = data?.status;
  let resolvedStatus = order.status;
  if (newOtpCode) {
    resolvedStatus = "done";
  } else if (providerStatus && KNOWN_TERMINAL.includes(String(providerStatus).toLowerCase())) {
    resolvedStatus = String(providerStatus).toLowerCase();
  }

  if (data) {
    await orders.updateOne(
      { orderId: order.orderId, refunded: { $ne: true } },
      { $set: { status: resolvedStatus, otpCode: newOtpCode, otpMsg: data.otp_msg || data.sms || order.otpMsg } }
    );
  }

  let refunded = false;
  let newBalance;
  if (resolvedStatus !== "done" && KNOWN_TERMINAL.includes(resolvedStatus) && !order.refunded) {
    const claimed = await orders.findOneAndUpdate(
      { orderId: order.orderId, token: order.token, refunded: false },
      { $set: { refunded: true } },
      { returnDocument: "after" }
    );
    if (claimed) {
      const users = await usersCol();
      const updatedUser = await users.findOneAndUpdate(
        { token: order.token },
        { $inc: { balance: order.price, depositBalance: order.price } },
        { returnDocument: "after" }
      );
      refunded = true;
      newBalance = updatedUser?.balance;
      await logBalance({
        token: order.token,
        type: "otp_refund",
        amount: order.price,
        balanceAfter: newBalance,
        title: `Refund OTP ${order.serviceName || ""} (${resolvedStatus === "expired" ? "kedaluwarsa" : "dibatalkan"})`,
        ref: order.orderId
      });
      sendTelegramNotif(
        otpAutoRefundNotif({
          orderId: order.orderId,
          serviceName: order.serviceName,
          countryName: order.countryName,
          price: order.price,
          token: order.token,
          reason:
            resolvedStatus === "expired"
              ? "Nomor kedaluwarsa tanpa kode OTP, saldo user dikembalikan otomatis."
              : "Pesanan dibatalkan provider, saldo user dikembalikan otomatis."
        })
      );
    }
  }

  let pointsEarned = 0;
  if (resolvedStatus === "done" && order.status !== "done") {
    const claimed = await orders.findOneAndUpdate(
      { orderId: order.orderId, token: order.token, pointsAwarded: { $ne: true } },
      { $set: { pointsAwarded: true } }
    );
    if (claimed) {
      const award = await awardTransactionPoints(order.token, order.price);
      pointsEarned = award.points;
    }
  }

  if (otpJustArrived) {
    const waited = order.createdAt
      ? (() => {
          const ms = Date.now() - new Date(order.createdAt).getTime();
          const s = Math.round(ms / 1000);
          if (s < 60) return `${s} detik`;
          const m = Math.floor(s / 60);
          return `${m} menit ${s % 60} detik`;
        })()
      : null;
    const receivedText = otpReceivedNotif({
      orderId: order.orderId,
      serviceName: order.serviceName,
      countryName: order.countryName,
      phoneNumber: order.phoneNumber,
      otpCode: newOtpCode,
      token: order.token,
      createdAt: order.createdAt
    });
    sendTelegramNotif(receivedText);
  }

  return { resolvedStatus, otpCode: newOtpCode, otpMsg: data?.otp_msg || data?.sms || order.otpMsg, refunded, newBalance, pointsEarned };
}
