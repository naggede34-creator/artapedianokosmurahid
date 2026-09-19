import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { usersCol, depositsCol } from "@/lib/db";
import { createTransaction } from "@/lib/pakasir";
import { createDeposit as createRumahOtpDeposit, toEpochMs } from "@/lib/rumahotp";
import { createSimuruDeposit, simuruConfigured } from "@/lib/simuru";
import { getSettings, depositLimits } from "@/lib/settings";
import { PROVIDER_KEYS } from "@/lib/paymentProviders";
import { sendTelegramNotif, depositPendingNotif, providerAlertNotif } from "@/lib/telegram";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const MAX_PENDING_PER_USER = 3;
const DEFAULT_QR_TTL_MS = 15 * 60 * 1000;

function pickField(obj, names) {
  for (const n of names) {
    if (obj?.[n] !== undefined && obj[n] !== null && obj[n] !== "") return obj[n];
  }
  return null;
}

function toNumberOrNull(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function asImageSrc(value) {
  if (!value || typeof value !== "string") return null;
  if (value.startsWith("data:") || value.startsWith("http")) return value;
  if (/^[A-Za-z0-9+/=\s]{200,}$/.test(value)) return `data:image/png;base64,${value.replace(/\s/g, "")}`;
  return null;
}

// RumahOTP kadang mengembalikan message sebagai object nested, bukan string.
// Fungsi ini normalisasi ke string agar tidak muncul "[object Object]" di frontend.
function toErrStr(v, fallback = "Terjadi kesalahan, coba lagi.") {
  if (!v) return fallback;
  if (typeof v === "string") return v;
  if (typeof v === "object") return v.message || v.error || v.description || JSON.stringify(v);
  return String(v);
}

export async function POST(req) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!rateLimit(`${ip}:deposit`, 5, 60_000)) {
      return NextResponse.json({ error: "Terlalu banyak percobaan. Coba lagi dalam 1 menit." }, { status: 429 });
    }
    const { token, amount, provider } = await req.json().catch(() => ({}));
    if (!token) return NextResponse.json({ error: "Kode akun tidak valid." }, { status: 400 });

    const { min: MIN, max: MAX } = depositLimits();
    const amt = Math.floor(Number(amount));
    if (!Number.isFinite(amt) || amt < MIN || amt > MAX) {
      return NextResponse.json(
        { error: `Nominal deposit harus antara Rp${MIN.toLocaleString("id-ID")} - Rp${MAX.toLocaleString("id-ID")}.` },
        { status: 400 }
      );
    }

    const { depositProviders } = await getSettings();
    const chosen = PROVIDER_KEYS.includes(provider) ? provider : null;
    if (!chosen || !depositProviders?.[chosen]) {
      return NextResponse.json({ error: "Metode pembayaran ini sedang tidak tersedia." }, { status: 400 });
    }
    if (chosen === "simuru" && !simuruConfigured()) {
      return NextResponse.json({ error: "QRIS Simuru belum dikonfigurasi admin. Pilih metode lain." }, { status: 400 });
    }

    const users = await usersCol();
    const user = await users.findOne({ token });
    if (!user) return NextResponse.json({ error: "Kode akun tidak ditemukan." }, { status: 404 });

    const deposits = await depositsCol();
    const pendingCount = await deposits.countDocuments({
      token,
      status: "pending",
      createdAt: { $gte: new Date(Date.now() - 30 * 60 * 1000) }
    });
    if (pendingCount >= MAX_PENDING_PER_USER) {
      return NextResponse.json(
        { error: "Kamu masih punya beberapa QRIS yang belum dibayar. Selesaikan atau batalkan dulu di Riwayat." },
        { status: 429 }
      );
    }

    const orderId = `DP${Date.now()}${Math.floor(Math.random() * 1000)}`;
    let qrisString = null;
    let qrImage = null;
    let expiredAt = null;
    let paymentUrl = null;
    let providerRef = orderId;
    let adminFee = null;
    let totalAmount = null;
    let paymentMethod = "qris";

    if (chosen === "simuru") {
      let data;
      try {
        data = await createSimuruDeposit({ amount: amt, note: `${orderId} ${token}` });
      } catch (err) {
        console.error("[deposit/create] simuru:", err?.message);
        if (err?.status === 401 || err?.status >= 500) {
          sendTelegramNotif(providerAlertNotif({ provider: "Simuru", action: "Buat deposit QRIS", message: err.message }));
        }
        const busy = err?.status === 422 && /pending/i.test(err?.message || "");
        return NextResponse.json(
          {
            error: busy
              ? "QRIS Simuru sedang ramai dipakai. Coba lagi 1-2 menit lagi atau pilih metode lain."
              : err?.message || "Gagal membuat QRIS Simuru, coba metode lain."
          },
          { status: 400 }
        );
      }
      providerRef = String(pickField(data, ["id", "deposit_id"]) || "");
      if (!providerRef) {
        return NextResponse.json({ error: "Respons Simuru tidak lengkap, coba lagi." }, { status: 502 });
      }
      qrisString = pickField(data, ["qr_string", "qris", "qris_string"]);
      qrImage = asImageSrc(pickField(data, ["qr_image", "qr_image_base64", "qr_base64", "qris_image", "qr_code_image"]));
      expiredAt = toEpochMs(pickField(data, ["expired_at", "expires_at"]));
      adminFee = toNumberOrNull(pickField(data, ["fee", "admin_fee"]));
      totalAmount = toNumberOrNull(pickField(data, ["total", "total_amount", "amount_total", "pay_amount", "amount_unique"])) ?? amt;
      paymentMethod = pickField(data, ["method"]) || "qris";
      if (!qrisString && !qrImage) {
        return NextResponse.json({ error: "QRIS Simuru tidak tersedia, coba lagi." }, { status: 502 });
      }
    } else if (chosen === "pakasir") {
      const result = await createTransaction(process.env.PAKASIR_PROJECT, process.env.PAKASIR_APIKEY, orderId, amt, "qris");
      const payment = result?.payment || result;
      qrisString = payment?.payment_number || payment?.qr_string || null;
      expiredAt = toEpochMs(payment?.expired_at || null);
      paymentUrl = payment?.payment_url || null;
      adminFee = toNumberOrNull(pickField(payment, ["fee", "admin_fee", "total_fee"]));
      totalAmount = toNumberOrNull(pickField(payment, ["total_payment", "total_amount", "amount_total", "total"])) ?? amt;
      if (!qrisString && !paymentUrl) {
        return NextResponse.json({ error: "Gagal membuat QRIS Pakasir, coba metode lain." }, { status: 400 });
      }
    } else {
      let result;
      try {
        result = await createRumahOtpDeposit(process.env.RUMAHOTP_APIKEY, { amount: amt, paymentId: "qris" });
      } catch (err) {
        const errData = err?.response?.data;
        console.error("[deposit/create] rumahotp request error:", err?.response?.status, errData || err?.message);
        const status = err?.response?.status;
        if (status === 401 || (status && status >= 500)) {
          sendTelegramNotif(providerAlertNotif({ provider: "RumahOTP", action: "Buat deposit QRIS", message: err.message }));
        }
        return NextResponse.json(
          { error: toErrStr(errData?.message || errData || err?.message, "Gagal membuat pembayaran RumahOTP, coba metode lain.") },
          { status: 400 }
        );
      }

      // Detect soft errors: API returns 200 but with error body
      const isSoftError =
        result?.success === false ||
        result?.status === false ||
        (result?.message && !result?.data);
      if (isSoftError) {
        console.error("[deposit/create] rumahotp soft error:", JSON.stringify(result));
        return NextResponse.json(
          { error: toErrStr(result?.message || result?.error, "Gagal membuat pembayaran RumahOTP, coba metode lain.") },
          { status: 400 }
        );
      }

      const data = result?.data || result;
      qrisString = pickField(data, ["qr_string", "qris", "payment_number", "qris_string", "qr_code", "qris_content"]);
      // Simpan URL qr_image sebagai fallback; kita selalu generate lokal dari qr_string
      const qrImageUrl = asImageSrc(pickField(data, ["qr_image", "qr_image_url"]));
      expiredAt = toEpochMs(
        pickField(data, ["expired_at_ts", "expires_at_ts", "expired_ts", "expired", "expired_at", "expire_at", "expires_at"])
      );
      paymentUrl = pickField(data, ["payment_url", "checkout_url", "payment_link"]);
      providerRef = String(pickField(data, ["id", "order_id", "trx_id", "reference", "deposit_id"]) || orderId);
      adminFee = toNumberOrNull(pickField(data, ["fee", "admin_fee", "biaya_admin", "total_fee"]));
      totalAmount = toNumberOrNull(pickField(data, ["total", "amount", "total_amount", "amount_total", "total_pembayaran"]));
      // currency.diterima = nominal bersih yang masuk (setelah dipotong fee)
      // currency.total / currency.fee = rincian per mata uang metode
      const curr = data?.currency;
      if (curr && typeof curr === "object") {
        if (adminFee === null) adminFee = toNumberOrNull(curr.fee);
        if (totalAmount === null) totalAmount = toNumberOrNull(curr.total) ?? toNumberOrNull(curr.diterima);
      }
      if (totalAmount === null) totalAmount = amt;
      // Selalu generate QR lokal dari qr_string (lebih andal, tidak bergantung URL eksternal yang bisa expire)
      if (qrisString) {
        try {
          qrImage = await QRCode.toDataURL(String(qrisString), { margin: 1, scale: 8, errorCorrectionLevel: "M" });
        } catch {
          qrImage = qrImageUrl; // fallback ke URL jika generate gagal
        }
      } else {
        qrImage = qrImageUrl; // fallback: pakai URL dari RumahOTP
      }
      if (!qrisString && !qrImage && !paymentUrl) {
        console.error("[deposit/create] rumahotp missing qris fields, full response:", JSON.stringify(result));
        return NextResponse.json(
          { error: toErrStr(data?.message || result?.message, "Gagal membuat pembayaran RumahOTP, coba metode lain.") },
          { status: 400 }
        );
      }
    }

    if (!qrImage && qrisString) {
      qrImage = await QRCode.toDataURL(String(qrisString), { margin: 1, scale: 8, errorCorrectionLevel: "M" });
    }
    if (!expiredAt) expiredAt = Date.now() + DEFAULT_QR_TTL_MS;

    await deposits.insertOne({
      orderId,
      providerRef,
      token,
      amount: amt,
      adminFee,
      totalAmount,
      method: paymentMethod,
      provider: chosen,
      // QR disimpan supaya halaman deposit bisa menampilkan lagi QR yang sama setelah
      // di-refresh. Dihapus otomatis oleh cron setelah deposit lewat 24 jam.
      qrImage,
      paymentUrl,
      status: "pending",
      credited: false,
      createdAt: new Date(),
      expiredAt: new Date(expiredAt)
    });

    const pendingText = depositPendingNotif({
      orderId, providerRef, provider: chosen, amount: amt,
      fee: adminFee, total: totalAmount, expiredAt, token, name: user.name
    });
    sendTelegramNotif(pendingText);

    return NextResponse.json({
      orderId,
      providerRef: providerRef !== orderId ? providerRef : null,
      amount: amt,
      adminFee,
      totalAmount,
      method: paymentMethod,
      provider: chosen,
      qrImage,
      expiredAt,
      paymentUrl: paymentUrl || null,
      createdAt: new Date().toISOString(),
      status: "pending"
    });
  } catch (err) {
    console.error("[deposit/create]", err?.response?.data || err?.message || err);
    return NextResponse.json({ error: "Gagal membuat transaksi deposit. Coba lagi sebentar lagi." }, { status: 500 });
  }
}
