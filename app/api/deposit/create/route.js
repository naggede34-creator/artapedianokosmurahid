import { NextResponse } from "next/server";
import { usersCol, depositsCol } from "@/lib/db";
import { createTransaction } from "@/lib/pakasir";
import { createDeposit, toEpochMs } from "@/lib/rumahotp";
import { getSettings } from "@/lib/settings";
import { sendTelegramNotif, depositPendingNotif } from "@/lib/telegram";
import QRCode from "qrcode";

const MIN = Number(process.env.DEPOSIT_MIN_AMOUNT || 2000);
const MAX = Number(process.env.DEPOSIT_MAX_AMOUNT || 1000000);

// Ambil string QRIS / link pembayaran dari respons provider dengan mencoba beberapa
// kemungkinan nama field, sama seperti pola extractCode di otp/status — supaya kalau
// nama field asli RumahOTP sedikit beda dari dugaan, tampilannya tidak langsung rusak.
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

export async function POST(req) {
  try {
    const { token, amount, provider, method } = await req.json();
    if (!token) return NextResponse.json({ error: "Kode akun tidak valid." }, { status: 400 });

    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt < MIN || amt > MAX) {
      return NextResponse.json(
        { error: `Nominal deposit harus antara Rp${MIN.toLocaleString("id-ID")} - Rp${MAX.toLocaleString("id-ID")}.` },
        { status: 400 }
      );
    }

    const { depositProviders } = await getSettings();
    const chosenProvider = provider === "rumahotp" ? "rumahotp" : "pakasir";
    if (!depositProviders?.[chosenProvider]) {
      return NextResponse.json({ error: "Metode pembayaran ini sedang tidak tersedia." }, { status: 400 });
    }

    const users = await usersCol();
    const user = await users.findOne({ token });
    if (!user) return NextResponse.json({ error: "Kode akun tidak ditemukan." }, { status: 404 });

    const orderId = `DP${Date.now()}${Math.floor(Math.random() * 1000)}`;
    let qrisString = null;
    let qrImage = null;
    let expiredAt = null;
    let paymentUrl = null;
    let providerRef = orderId; // dipakai untuk get_status/cancel ke provider nanti
    let adminFee = null;
    let totalAmount = null;
    let paymentMethod = chosenProvider === "rumahotp" ? (method || "qris") : "qris";
    let currencyInfo = null;

    if (chosenProvider === "pakasir") {
      const result = await createTransaction(process.env.PAKASIR_PROJECT, process.env.PAKASIR_APIKEY, orderId, amt, "qris");
      const payment = result.payment || result;
      qrisString = payment.payment_number || payment.qr_string || null;
      expiredAt = toEpochMs(payment.expired_at || null);
      paymentUrl = payment.payment_url || null;
      adminFee = toNumberOrNull(pickField(payment, ["fee", "admin_fee", "total_fee"]));
      totalAmount = toNumberOrNull(pickField(payment, ["total_amount", "amount_total", "total"])) ?? amt;
    } else {
      const result = await createDeposit(process.env.RUMAHOTP_APIKEY, { amount: amt, orderId, paymentId: paymentMethod });
      const data = result.data || result;
      qrisString = pickField(data, ["qr_string", "qris", "payment_number", "qris_string", "qr_code", "qris_content"]);
      qrImage = pickField(data, ["qr_image", "qr_image_url"]);
      // Ambil epoch ms yang paling bisa dipercaya duluan (field *_ts), baru
      // jatuh ke bentuk lain — toEpochMs() menormalkan apapun bentuknya jadi
      // angka epoch ms yang benar, jadi urutan di sini cuma soal prioritas.
      expiredAt = toEpochMs(
        pickField(data, ["expired_at_ts", "expires_at_ts", "expired_ts", "expired", "expired_at", "expire_at", "expires_at"])
      );
      paymentUrl = pickField(data, ["payment_url", "checkout_url", "payment_link"]);
      providerRef = pickField(data, ["id", "order_id", "trx_id", "reference", "deposit_id"]) || orderId;
      adminFee = toNumberOrNull(pickField(data, ["fee", "admin_fee", "biaya_admin", "total_fee"]));
      totalAmount = toNumberOrNull(pickField(data, ["total", "amount", "total_amount", "amount_total", "total_pembayaran"])) ?? amt;
      paymentMethod = pickField(data, ["method"]) || paymentMethod;
      const curr = data?.currency;
      if (curr && typeof curr === "object") {
        currencyInfo = {
          type: curr.type || null,
          total: curr.total ?? null,
          fee: curr.fee ?? null,
          diterima: curr.diterima ?? null
        };
        // Untuk metode qris, biaya admin & total kadang cuma ada di dalam
        // "currency" (bukan di top-level data) meski satuannya sama-sama IDR.
        if (curr.type === "IDR") {
          if (adminFee === null) adminFee = toNumberOrNull(curr.fee);
          if (totalAmount === null) totalAmount = toNumberOrNull(curr.total);
        }
      }
      if (!qrisString && !qrImage && !paymentUrl) {
        return NextResponse.json(
          { error: data?.message || "Gagal membuat pembayaran RumahOTP, coba metode lain." },
          { status: 400 }
        );
      }
    }

    if (!qrImage && qrisString) {
      qrImage = await QRCode.toDataURL(qrisString, { margin: 1, scale: 6 });
    }

    const deposits = await depositsCol();
    await deposits.insertOne({
      orderId,
      providerRef,
      token,
      amount: amt,
      adminFee,
      totalAmount,
      method: paymentMethod,
      currency: currencyInfo,
      provider: chosenProvider,
      status: "pending",
      credited: false,
      createdAt: new Date(),
      expiredAt: expiredAt ? new Date(expiredAt) : null
    });

    sendTelegramNotif(depositPendingNotif({ orderId, amount: amt, token }));

    return NextResponse.json({
      orderId,
      providerRef: providerRef !== orderId ? providerRef : null,
      amount: amt,
      adminFee,
      totalAmount,
      method: paymentMethod,
      currency: currencyInfo,
      provider: chosenProvider,
      qrImage,
      expiredAt: expiredAt || null,
      paymentUrl: paymentUrl || null
    });
  } catch (err) {
    console.error(err?.response?.data || err);
    return NextResponse.json({ error: "Gagal membuat transaksi deposit. Coba lagi sebentar lagi." }, { status: 500 });
  }
}
