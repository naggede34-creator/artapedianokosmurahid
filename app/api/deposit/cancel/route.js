// Pembatalan deposit ada di lib/depositOrderService.js supaya web dan bot
// Telegram memakai logika yang sama persis.
import { NextResponse } from "next/server";
import { cancelDepositForToken } from "@/lib/depositOrderService";

export async function POST(req) {
  try {
    const { token, orderId } = await req.json().catch(() => ({}));
    const result = await cancelDepositForToken({ token, orderId });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, ...(result.depositStatus ? { status: result.depositStatus } : {}) },
        { status: result.status }
      );
    }

    return NextResponse.json({
      ok: true,
      ...(result.status ? { status: result.status } : {}),
      ...(result.message ? { message: result.message } : {})
    });
  } catch (err) {
    console.error("[deposit/cancel]", err?.response?.data || err?.message || err);
    return NextResponse.json({ error: "Gagal membatalkan transaksi." }, { status: 500 });
  }
}
