// Logika inti pengecekan status pesanan OTP ke provider (RumahOTP / WarungNokos / dibanana) + efek sampingnya
// (auto-refund kalau kedaluwarsa/dibatalkan, kasih poin kalau sukses).
// Dipisah dari app/api/otp/status/route.js supaya bisa dipakai juga oleh cron
// pembersihan (lib/cleanup.js) untuk merekonsiliasi pesanan "pending" yang macet
// karena user tidak pernah membuka lagi halaman statusnya.
import { otpOrdersCol, usersCol } from "@/lib/db";
import { kreditRefund } from "@/lib/saldoDeposit";
import { checkOrderStatus } from "@/lib/rumahotp";
import { getWarungNokosStatus, isWarungNokosServer, WARUNGNOKOS_TERMINAL } from "@/lib/warungnokos";
import { DIBANANA_TERMINAL, getDibananaStatus } from "@/lib/dibanana";
import {
  otpReceivedNotif,
  otpReceivedPublicNotif,
  otpAutoRefundNotif,
  otpRefundPublicNotif
} from "@/lib/telegram";
import { umumkan } from "@/lib/notifyHub";
import { notifyBotUser, otpArrivedText, refundText } from "@/lib/shopBot";
import { rekomendasiLayanan } from "@/lib/rekomendasi";
import { kirimPushCepat } from "@/lib/webPush";
import { pesananResellerSelesai } from "@/lib/resellerPaket";
import { bayarKomisiKreator } from "@/lib/afiliasi";
import { logBalance } from "@/lib/ledger";
import { tarikKomisi } from "@/lib/resellerKomisi";
import { kabariPemilikBot, botResellerSekarang } from "@/lib/kirimReseller";
import { resellerOtpNotif, resellerRefundNotif } from "@/lib/resellerNotif";
import { cfg } from "@/lib/config";
import { jalankanJaminan, syaratBolehRefund } from "@/lib/jaminan";

const rupiahPush = (n) => `Rp${Number(n || 0).toLocaleString("id-ID")}`;

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
      // Kode WhatsApp biasanya ditulis "123-456" — gabungkan jadi 6 digit.
      const split = text.match(/\b(\d{3})[-\s](\d{3})\b/);
      if (split) return split[1] + split[2];
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
      pointsEarned: 0,
      // Pesanan ini sudah diganti jaminan: pemanggil diarahkan ke nomor barunya.
      ...(order.gantiKe ? { gantiKe: order.gantiKe } : {})
    };
  }
  const fromWarungNokos = isWarungNokosServer(order.server);
  const fromDibanana = order.server === "dibanana";
  let data;
  if (fromDibanana) {
    const r = await getDibananaStatus(order.orderId);
    data = { status: r.status, otp_code: r.code, sms: r.sms };
  } else if (fromWarungNokos) {
    const r = await getWarungNokosStatus(order.server, order.orderId);
    // Diseragamkan ke bentuk yang sama dengan RumahOTP supaya sisa logika di
    // bawah tidak perlu tahu providernya.
    data = { status: r.status, otp_code: r.otp };
  } else {
    const result = await checkOrderStatus((await cfg("RUMAHOTP_APIKEY")), order.orderId);
    data = result.data || result;
  }

  const extractedCode = extractCode(data);
  const newOtpCode = extractedCode || order.otpCode;
  const otpJustArrived = !order.otpCode && !!newOtpCode;

  const providerStatus = data?.status;
  let resolvedStatus = order.status;
  if (newOtpCode) {
    resolvedStatus = "done";
  } else if (providerStatus) {
    const statusLow = String(providerStatus).toLowerCase();
    const terminalList = fromDibanana ? DIBANANA_TERMINAL : fromWarungNokos ? WARUNGNOKOS_TERMINAL : KNOWN_TERMINAL;
    if (terminalList.includes(statusLow)) {
      resolvedStatus = statusLow === "cancelled" ? "canceled" : statusLow;
    }
  }

  // Jaminan OTP: belum ada kode, dan nomornya sudah cukup lama menunggu (atau
  // baru saja kedaluwarsa). Kalau jalan, hasilnya menggantikan sisa fungsi ini
  // — pesanan lama sudah dilepas dan tidak ada yang perlu direfund lagi.
  if (order.jaminanBiaya && !order.jaminanGanti && !newOtpCode && (resolvedStatus === "pending" || resolvedStatus === "expired")) {
    const j = await jalankanJaminan(order, { sudahMati: resolvedStatus === "expired" });
    if (j?.gantiKe) {
      return { resolvedStatus: "canceled", otpCode: null, otpMsg: null, refunded: false, newBalance: undefined, pointsEarned: 0, gantiKe: j.gantiKe };
    }
    if (j?.refunded) {
      return { resolvedStatus: "canceled", otpCode: null, otpMsg: null, refunded: true, newBalance: j.newBalance, pointsEarned: 0 };
    }
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
      { orderId: order.orderId, token: order.token, refunded: false, ...syaratBolehRefund() },
      { $set: { refunded: true } },
      { returnDocument: "after" }
    );
    if (claimed) {
      const users = await usersCol();
      // Biaya jaminan ikut kembali: tanpa kode OTP, jaminannya tidak terpakai.
      const totalRefund = order.price + (Number(order.jaminanBiaya) || 0);
      const updatedUser = await kreditRefund(order.token, totalRefund, order.depositBagian);
      refunded = true;
      newBalance = updatedUser?.balance;

      // Komisi resellernya ikut ditarik. Jalur ini yang paling sering dipakai
      // (nomor kedaluwarsa tanpa OTP), jadi melewatkannya di sini berarti
      // komisi dari pesanan yang gagal menumpuk diam-diam.
      const ditarik = await tarikKomisi(order.komisiOrderId || order.orderId);

      await logBalance({
        token: order.token,
        type: "otp_refund",
        amount: totalRefund,
        balanceAfter: newBalance,
        title: `Refund OTP ${order.serviceName || ""} (${resolvedStatus === "expired" ? "kedaluwarsa" : "dibatalkan"})`,
        ref: order.orderId
      });
      const sebab =
        resolvedStatus === "expired"
          ? "Nomor kedaluwarsa tanpa kode OTP, saldo user dikembalikan otomatis."
          : "Pesanan dibatalkan provider, saldo user dikembalikan otomatis.";
      umumkan({
        jenis: "otp_refund",
        admin: otpAutoRefundNotif({
          orderId: order.orderId,
          serviceName: order.serviceName,
          countryName: order.countryName,
          price: order.price,
          token: order.token,
          reason: sebab,
          phoneNumber: order.phoneNumber,
          server: order.server,
          balance: newBalance,
          name: updatedUser?.name || null
        }),
        publik: otpRefundPublicNotif({
          serviceName: order.serviceName,
          countryName: order.countryName,
          price: order.price,
          token: order.token,
          reason: resolvedStatus === "expired" ? "nomor kedaluwarsa" : "dibatalkan provider"
        })
      });
      // Pemilik bot reseller dikabari kalau komisinya benar-benar ditarik.
      // Hanya kalau `berubah` — penarikan yang sudah pernah terjadi tidak
      // mengubah apa pun, dan mengabarkannya lagi cuma membuat resellernya
      // mengira komisinya dipotong dua kali.
      if (ditarik?.berubah && order.resellerBotId) {
        (async () => {
          try {
            const dok = await botResellerSekarang({ jenis: "reseller", botId: order.resellerBotId });
            if (!dok) return;
            await kabariPemilikBot(
              dok,
              resellerRefundNotif({
                botUsername: dok.username,
                botNama: dok.nama,
                ownerUsername: dok.ownerUsername,
                serviceName: order.serviceName,
                countryName: order.countryName,
                phoneNumber: order.phoneNumber,
                komisi: ditarik.komisi,
                harga: order.price,
                sebab: resolvedStatus === "expired" ? "Nomor kedaluwarsa tanpa kode OTP." : "Pesanan dibatalkan provider."
              })
            );
          } catch (e) {
            console.error("[reseller] notif refund gagal:", e?.message || e);
          }
        })();
      }

      await kirimPushCepat(order.token, {
        judul: "Saldo dikembalikan 💸",
        isi: `${order.serviceName || "Pesananmu"} tidak mendapat kode. ${rupiahPush(totalRefund)} sudah kembali ke saldo.`,
        url: "/otp",
        tag: `refund-${order.orderId}`
      });

      // Kalau user datang dari bot, kabari langsung di chat-nya.
      notifyBotUser(
        order.token,
        refundText({ serviceName: order.serviceName, price: totalRefund, balance: newBalance })
      );
    }
  }

  const pointsEarned = 0;
  if (resolvedStatus === "done" && order.status !== "done") {
    const claimed = await orders.findOneAndUpdate(
      { orderId: order.orderId, token: order.token, pointsAwarded: { $ne: true } },
      { $set: { pointsAwarded: true } }
    );
    if (claimed) {
      // Total belanja (dasar papan peringkat pembeli & level reseller) dicatat sekali per pesanan.
      await (await usersCol()).updateOne({ token: order.token }, { $inc: { totalSpent: Number(order.price) || 0 } });
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
    const pembeli = await (await usersCol()).findOne({ token: order.token }, { projection: { name: 1, balance: 1 } }).catch(() => null);
    const receivedText = otpReceivedNotif({
      orderId: order.orderId,
      serviceName: order.serviceName,
      countryName: order.countryName,
      phoneNumber: order.phoneNumber,
      otpCode: newOtpCode,
      token: order.token,
      createdAt: order.createdAt,
      name: pembeli?.name || null,
      balance: pembeli?.balance,
      price: order.price,
      server: order.server
    });
    // Salinan ke channel TANPA kode OTP-nya: kode itu milik pembeli yang
    // membayarnya, dan siapa pun yang membacanya lebih dulu bisa memakainya.
    // Yang dibutuhkan channel cuma bukti bahwa pesanannya sampai.
    umumkan({
      jenis: "otp_masuk",
      admin: receivedText,
      publik: otpReceivedPublicNotif({
        serviceName: order.serviceName,
        countryName: order.countryName,
        phoneNumber: order.phoneNumber,
        token: order.token,
        createdAt: order.createdAt
      })
    });
    // Pemilik bot reseller dikabari juga. Dijalankan dari cron, di luar
    // konteks bot mana pun, jadi botnya dicari dari resellerBotId yang
    // tersimpan di pesanannya.
    if (order.resellerBotId) {
      // Mulai dihitung sebagai omzet level, dan bonus targetnya diperiksa.
      await pesananResellerSelesai(order.komisiOrderId || order.orderId);
      (async () => {
        try {
          const dok = await botResellerSekarang({ jenis: "reseller", botId: order.resellerBotId });
          if (!dok) return;
          await kabariPemilikBot(
            dok,
            resellerOtpNotif({
              botUsername: dok.username,
              botNama: dok.nama,
              ownerUsername: dok.ownerUsername,
              serviceName: order.serviceName,
              phoneNumber: order.phoneNumber,
              username: null
            })
          );
        } catch (e) {
          console.error("[reseller] notif OTP gagal:", e?.message || e);
        }
      })();
    }

    // Program kreator: teman seorang kreator baru saja berhasil beli.
    await bayarKomisiKreator({ ...order, otpCode: newOtpCode });

    // Push web: tanpa kode OTP-nya (layar kunci). Ditunggu sebentar saja —
    // serverless membekukan fungsi setelah respons, push yang dilepas begitu
    // saja bisa tidak pernah terkirim.
    await kirimPushCepat(order.token, {
      judul: "Kode OTP masuk 🎉",
      isi: `${order.serviceName || "Pesananmu"} — ketuk untuk melihat kodenya.`,
      url: "/otp",
      tag: `otp-${order.orderId}`
    });
    // Saran diambil dulu, dan kegagalannya (mengembalikan []) tidak menahan OTP.
    const rekomendasi = await rekomendasiLayanan({ serviceName: order.serviceName, server: order.server });
    notifyBotUser(
      order.token,
      otpArrivedText({
        serviceName: order.serviceName,
        countryName: order.countryName,
        phoneNumber: order.phoneNumber,
        otpCode: newOtpCode,
        rekomendasi
      })
    );
  }

  return { resolvedStatus, otpCode: newOtpCode, otpMsg: data?.otp_msg || data?.sms || order.otpMsg, refunded, newBalance, pointsEarned };
}
