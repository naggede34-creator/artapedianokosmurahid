import { NextResponse } from "next/server";
import { otpOrdersCol, usersCol } from "@/lib/db";
import { setOrderStatus } from "@/lib/rumahotp";
import { cancelVirtusimOrder } from "@/lib/virtusim";
import { reconcileOtpOrder } from "@/lib/orderReconcile";
import { logBalance } from "@/lib/ledger";

const CANCEL_COOLDOWN_MS = 3 * 60 * 1000;

export async function POST(req) {
  try {
    const { token, orderId } = await req.json().catch(() => ({}));
    if (!token || !orderId) return NextResponse.json({ error: "Parameter kurang." }, { status: 400 });

    const orders = await otpOrdersCol();
    const users = await usersCol();
    const order = await orders.findOne({ orderId, token });
    if (!order) return NextResponse.json({ error: "Pesanan tidak ditemukan." }, { status: 404 });

    if (order.refunded) {
      const current = await users.findOne({ token });
      return NextResponse.json({
        ok: true,
        balance: current?.balance,
        message: "Pesanan ini sudah dibatalkan dan saldonya sudah dikembalikan sebelumnya."
      });
    }
    if (order.otpCode || order.status === "done") {
      return NextResponse.json({ error: "Kode OTP sudah masuk, pesanan ini tidak bisa dibatalkan." }, { status: 400 });
    }

    const elapsed = Date.now() - new Date(order.createdAt).getTime();
    if (elapsed < CANCEL_COOLDOWN_MS) {
      const remainingSec = Math.ceil((CANCEL_COOLDOWN_MS - elapsed) / 1000);
      return NextResponse.json(
        {
          error: `Pesanan baru bisa dibatalkan 3 menit setelah dibeli. Tunggu ${remainingSec} detik lagi.`,
          remainingMs: CANCEL_COOLDOWN_MS - elapsed
        },
        { status: 400 }
      );
    }

    // Cek status terakhir di provider SEBELUM refund. Tanpa ini, user bisa menekan
    // batal tepat setelah OTP masuk di provider (tapi belum ter-polling) dan
    // mendapat kode OTP sekaligus refund.
    try {
      const r = await reconcileOtpOrder(order);
      if (r.otpCode) {
        return NextResponse.json(
          { error: "Kode OTP baru saja masuk, pesanan tidak bisa dibatalkan.", otpCode: r.otpCode, status: "done" },
          { status: 409 }
        );
      }
      if (r.refunded) {
        return NextResponse.json({ ok: true, balance: r.newBalance, message: "Pesanan sudah dibatalkan provider, saldo dikembalikan." });
      }
    } catch (e) {
      return NextResponse.json({ error: "Status pesanan belum bisa dicek ke server. Coba lagi sebentar." }, { status: 503 });
    }

    let providerMessage;
    if (order.provider === "virtusim") {
      // Server OTP Fast (VirtuSIM): nomor HARUS berhasil dilepas di provider dulu.
      // Kalau gagal, saldo tidak dikembalikan supaya nomor yang masih aktif tidak
      // terbayar dua kali — pesanan tetap refund otomatis begitu kedaluwarsa.
      try {
        const msg = await cancelVirtusimOrder(order.providerRef || String(orderId).replace(/^VS/, ""));
        providerMessage = msg || undefined;
      } catch (e) {
        console.error("[otp/cancel] VirtuSIM cancel gagal:", e?.message || e);
        if (/otp|sms|received|diterima|kode|code/i.test(String(e?.message || ""))) {
          return NextResponse.json({ error: "Server menolak pembatalan karena kode sudah masuk. Muat ulang pesanan." }, { status: 409 });
        }
        return NextResponse.json(
          { error: "Pesanan belum bisa dibatalkan di server OTP Fast. Coba lagi sebentar, atau tunggu kedaluwarsa — saldo kembali otomatis." },
          { status: 502 }
        );
      }
    } else {
      try {
        const result = await setOrderStatus(process.env.RUMAHOTP_APIKEY, orderId, "cancel");
        const d = result?.data || result;
        providerMessage = d?.message;
        if (result?.success === false && /otp|sms|received|diterima/i.test(String(providerMessage || ""))) {
          return NextResponse.json({ error: "Provider menolak pembatalan karena kode sudah masuk. Muat ulang pesanan." }, { status: 409 });
        }
      } catch (e) {
        console.error("[otp/cancel] setOrderStatus gagal, lanjut refund lokal:", e?.response?.data || e?.message || e);
      }
    }

    const claimed = await orders.findOneAndUpdate(
      { orderId, token, refunded: false, otpCode: null },
      { $set: { status: "canceled", refunded: true, canceledAt: new Date() } }
    );
    if (!claimed) {
      const current = await users.findOne({ token });
      return NextResponse.json({ ok: true, balance: current?.balance, message: "Pesanan ini sudah diproses sebelumnya." });
    }

    const updated = await users.findOneAndUpdate({ token }, { $inc: { balance: order.price } }, { returnDocument: "after" });
    await logBalance({
      token,
      type: "otp_refund",
      amount: order.price,
      balanceAfter: updated?.balance,
      title: `Batal OTP ${order.serviceName || ""}`.trim(),
      ref: orderId
    });

    return NextResponse.json({ ok: true, balance: updated?.balance, message: providerMessage });
  } catch (err) {
    console.error("[otp/cancel]", err?.response?.data || err?.message || err);
    return NextResponse.json({ error: "Gagal membatalkan pesanan. Coba lagi atau hubungi admin." }, { status: 500 });
  }
}
