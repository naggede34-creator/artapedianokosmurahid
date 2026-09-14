import { NextResponse } from "next/server";
import { depositsCol } from "@/lib/db";
import { cancelTransaction } from "@/lib/pakasir";
import { cancelDeposit } from "@/lib/rumahotp";

export async function POST(req) {
  try {
    const { token, orderId } = await req.json();
    if (!token || !orderId) return NextResponse.json({ error: "Parameter kurang." }, { status: 400 });

    const deposits = await depositsCol();
    const deposit = await deposits.findOne({ orderId, token });
    if (!deposit) return NextResponse.json({ error: "Transaksi tidak ditemukan." }, { status: 404 });
    if (deposit.status === "completed") {
      return NextResponse.json({ error: "Transaksi ini sudah berhasil, tidak bisa dibatalkan." }, { status: 400 });
    }
    if (deposit.status === "canceled") {
      return NextResponse.json({ ok: true, message: "Transaksi ini sudah dibatalkan sebelumnya." });
    }

    // Tandai batal di sistem kita dulu — ini yang sebenarnya menentukan tombol "Buat
    // transaksi baru" muncul di UI, tidak tergantung provider berhasil dihubungi atau
    // tidak (tidak ada saldo yang perlu dikembalikan di sini karena saldo belum pernah
    // dipotong untuk deposit yang masih pending).
    await deposits.updateOne({ orderId, token }, { $set: { status: "canceled" } });

    if (deposit.provider === "pakasir") {
      try {
        await cancelTransaction(process.env.PAKASIR_PROJECT, process.env.PAKASIR_APIKEY, orderId, deposit.amount);
      } catch (e) {
        // Tidak fatal — status lokal sudah "canceled", QRIS yang belum dibayar toh
        // otomatis kedaluwarsa sendiri di sisi Pakasir.
      }
    } else if (deposit.provider === "rumahotp") {
      try {
        await cancelDeposit(process.env.RUMAHOTP_APIKEY, deposit.providerRef || orderId);
      } catch (e) {
        // Tidak fatal — sama seperti Pakasir, status lokal sudah "canceled" dan
        // QRIS yang belum dibayar otomatis kedaluwarsa sendiri di sisi RumahOTP.
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err?.response?.data || err);
    return NextResponse.json({ error: "Gagal membatalkan transaksi." }, { status: 500 });
  }
}
