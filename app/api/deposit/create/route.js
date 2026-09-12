import { NextResponse } from "next/server";
import { usersCol, depositsCol } from "@/lib/db";
import { createTransaction } from "@/lib/pakasir";
import { sendTelegramNotif, depositPendingNotif } from "@/lib/telegram";
import QRCode from "qrcode";

const MIN = Number(process.env.DEPOSIT_MIN_AMOUNT || 2000);
const MAX = Number(process.env.DEPOSIT_MAX_AMOUNT || 1000000);

export async function POST(req) {
  try {
    const { token, amount } = await req.json();
    if (!token) return NextResponse.json({ error: "Kode akun tidak valid." }, { status: 400 });

    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt < MIN || amt > MAX) {
      return NextResponse.json(
        { error: `Nominal deposit harus antara Rp${MIN.toLocaleString("id-ID")} - Rp${MAX.toLocaleString("id-ID")}.` },
        { status: 400 }
      );
    }

    const users = await usersCol();
    const user = await users.findOne({ token });
    if (!user) return NextResponse.json({ error: "Kode akun tidak ditemukan." }, { status: 404 });

    const orderId = `DP${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const result = await createTransaction(
      process.env.PAKASIR_PROJECT,
      process.env.PAKASIR_APIKEY,
      orderId,
      amt,
      "qris"
    );

    const payment = result.payment || result;
    const qrisString = payment.payment_number || payment.qr_string || null;
    let qrImage = null;
    if (qrisString) {
      qrImage = await QRCode.toDataURL(qrisString, { margin: 1, scale: 6 });
    }

    const deposits = await depositsCol();
    await deposits.insertOne({
      orderId,
      token,
      amount: amt,
      status: "pending",
      credited: false,
      createdAt: new Date(),
      expiredAt: payment.expired_at ? new Date(payment.expired_at) : null
    });

    sendTelegramNotif(depositPendingNotif({ orderId, amount: amt, token }));

    return NextResponse.json({
      orderId,
      amount: amt,
      qrImage,
      expiredAt: payment.expired_at || null,
      paymentUrl: payment.payment_url || null
    });
  } catch (err) {
    console.error(err?.response?.data || err);
    return NextResponse.json({ error: "Gagal membuat transaksi deposit. Coba lagi sebentar lagi." }, { status: 500 });
  }
}
