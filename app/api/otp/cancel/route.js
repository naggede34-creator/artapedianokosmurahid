import { NextResponse } from "next/server";
import { otpOrdersCol, usersCol } from "@/lib/db";
import { setOrderStatus } from "@/lib/rumahotp";

const CANCEL_COOLDOWN_MS = 3 * 60 * 1000;

export async function POST(req) {
  try {
    const { token, orderId } = await req.json();
    if (!token || !orderId) return NextResponse.json({ error: "Parameter kurang." }, { status: 400 });

    const orders = await otpOrdersCol();
    const order = await orders.findOne({ orderId, token });
    if (!order) return NextResponse.json({ error: "Pesanan tidak ditemukan." }, { status: 404 });
    if (order.refunded) {
      const users = await usersCol();
      const current = await users.findOne({ token });
      return NextResponse.json({
        ok: true,
        balance: current?.balance,
        message: "Pesanan ini sudah dibatalkan dan saldonya sudah dikembalikan sebelumnya."
      });
    }
    if (order.otpCode) {
      return NextResponse.json({ error: "Kode OTP sudah masuk, pesanan ini tidak bisa dibatalkan." }, { status: 400 });
    }

    const createdAt = new Date(order.createdAt).getTime();
    const elapsed = Date.now() - createdAt;
    if (elapsed < CANCEL_COOLDOWN_MS) {
      const remainingSec = Math.ceil((CANCEL_COOLDOWN_MS - elapsed) / 1000);
      return NextResponse.json(
        {
          error: `Pesanan baru bisa dibatalkan setelah 3 menit dari waktu beli. Tunggu ${remainingSec} detik lagi.`,
          remainingMs: CANCEL_COOLDOWN_MS - elapsed
        },
        { status: 400 }
      );
    }

    // Tandai dulu order ini "sudah diproses" secara atomik (filter refunded:false)
    // SEBELUM menyentuh saldo, supaya tidak ada request dobel yang bisa nge-refund
    // dua kali kalau user pencet tombol batal berkali-kali atau baris ini kepanggil
    // barengan sama polling status.
    const claimed = await orders.findOneAndUpdate(
      { orderId, token, refunded: false },
      { $set: { status: "canceled", refunded: true } },
      { returnDocument: "after" }
    );
    if (!claimed) {
      // Sudah diklaim (mis. oleh polling status yang mendeteksi provider membatalkan
      // duluan) sebelum request ini sampai. Bukan error dari sisi user — saldonya
      // memang sudah balik, jadi kasih tahu itu, bukan gagal.
      const users = await usersCol();
      const current = await users.findOne({ token });
      return NextResponse.json({
        ok: true,
        balance: current?.balance,
        message: "Pesanan ini sudah dibatalkan dan saldonya sudah dikembalikan sebelumnya."
      });
    }

    // Baru sekarang beri tahu provider. Kalau panggilan ke provider gagal (order
    // memang sudah tidak aktif di sisi mereka, timeout, dll), saldo user TETAP harus
    // balik — status "canceled" di sistem kita sudah jadi sumber kebenaran, jangan
    // sampai gagal refund cuma gara-gara API provider error/lambat.
    let providerMessage;
    try {
      const result = await setOrderStatus(process.env.RUMAHOTP_APIKEY, orderId, "cancel");
      providerMessage = (result?.data || result)?.message;
    } catch (e) {
      console.error("[otp/cancel] setOrderStatus gagal, lanjut refund lokal:", e?.response?.data || e?.message || e);
    }

    const users = await usersCol();
    const updated = await users.findOneAndUpdate(
      { token },
      { $inc: { balance: order.price } },
      { returnDocument: "after" }
    );

    return NextResponse.json({ ok: true, balance: updated?.balance, message: providerMessage });
  } catch (err) {
    console.error(err?.response?.data || err);
    return NextResponse.json({ error: "Gagal membatalkan pesanan. Coba lagi atau hubungi admin." }, { status: 500 });
  }
}
