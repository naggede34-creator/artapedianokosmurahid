import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { usersCol, depositsCol } from "@/lib/db";
import { createTransaction, normalizePakasirTransaction } from "@/lib/pakasir";
import { createDeposit as createRumahOtpDeposit, toEpochMs, rumahOtpConfigured } from "@/lib/rumahotp";
import { createRuangOtpDeposit, isRuangOtpDeposit, ruangOtpConfigured } from "@/lib/ruangotp";
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
    if (isRuangOtpDeposit(chosen) && !ruangOtpConfigured()) {
      return NextResponse.json({ error: "QRIS RuangOTP belum dikonfigurasi admin. Pilih metode lain." }, { status: 400 });
    }
    if (chosen === "rumahotp" && !rumahOtpConfigured()) {
      return NextResponse.json({ error: "QRIS RumahOTP belum dikonfigurasi. Pilih metode lain." }, { status: 400 });
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
    // txn_id dari Pakasir v2 — kunci untuk cek status & pembatalan.
    let pakasirTxnId = null;
    let paymentMethod = "qris";

    if (isRuangOtpDeposit(chosen)) {
      let dep;
      try {
        dep = await createRuangOtpDeposit(chosen, amt);
      } catch (err) {
        console.error("[deposit/create] ruangotp:", err?.message);
        if (err?.ipBlocked || err?.status === 401 || err?.status >= 500) {
          sendTelegramNotif(
            providerAlertNotif({ provider: "RuangOTP", action: "Buat deposit QRIS", message: err.message })
          );
        }
        return NextResponse.json(
          {
            error: err?.ipBlocked
              ? "Deposit RuangOTP ditolak: IP server belum di-whitelist. Hubungi admin."
              : err?.message || "Gagal membuat QRIS RuangOTP, coba metode lain."
          },
          { status: 400 }
        );
      }
      providerRef = String(dep.id || "");
      if (!providerRef) {
        return NextResponse.json({ error: "Respons RuangOTP tidak lengkap, coba lagi." }, { status: 502 });
      }
      qrisString = dep.qrString ? String(dep.qrString) : null;
      qrImage = asImageSrc(dep.qrImage);
      expiredAt = dep.expiredAt;
      // total_pay sudah termasuk biaya; selisihnya yang jadi biaya admin.
      totalAmount = dep.totalPay ?? amt;
      adminFee = dep.totalPay != null ? Math.max(0, dep.totalPay - (dep.amountReceived ?? amt)) : null;
      if (!qrisString && !qrImage) {
        return NextResponse.json({ error: "QRIS RuangOTP tidak tersedia, coba metode lain." }, { status: 502 });
      }
    } else if (chosen === "pakasir") {
      let result;
      try {
        result = await createTransaction(process.env.PAKASIR_PROJECT, process.env.PAKASIR_APIKEY, orderId, amt, "qris");
      } catch (err) {
        console.error("[deposit/create] pakasir error:", err?.message || err);
        sendTelegramNotif(providerAlertNotif({ provider: "Pakasir", action: "Buat transaksi QRIS", message: err?.message || "gagal" }));
        return NextResponse.json({ error: "Gagal membuat QRIS Pakasir, coba metode lain." }, { status: 400 });
      }
      const payment = normalizePakasirTransaction(result);
      qrisString = payment.qrString ? String(payment.qrString) : null;
      expiredAt = toEpochMs(payment.expiredAt);
      paymentUrl = payment.paymentUrl || null;
      adminFee = toNumberOrNull(payment.fee);
      totalAmount = toNumberOrNull(payment.total) ?? amt;
      // txn_id WAJIB disimpan: cek status & pembatalan di API v2 memakai itu,
      // bukan order_id + amount seperti v1.
      pakasirTxnId = payment.txnId ? String(payment.txnId) : null;
      if (!pakasirTxnId) {
        console.error("[deposit/create] pakasir respons tanpa txn_id:", JSON.stringify(result).slice(0, 500));
        return NextResponse.json({ error: "Respons Pakasir tidak lengkap, coba metode lain." }, { status: 502 });
      }
      if (!qrisString && !paymentUrl) {
        console.error("[deposit/create] pakasir respons tanpa QRIS:", JSON.stringify(result).slice(0, 500));
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
      ...(pakasirTxnId ? { pakasirTxnId } : {}),
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
