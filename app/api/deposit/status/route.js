import { NextResponse } from "next/server";
import { depositsCol, usersCol } from "@/lib/db";
import { syncDeposit } from "@/lib/depositService";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get("order_id");
    const token = searchParams.get("token");
    if (!orderId || !token) return NextResponse.json({ error: "Parameter kurang." }, { status: 400 });

    const deposits = await depositsCol();
    const deposit = await deposits.findOne({ orderId, token });
    if (!deposit) return NextResponse.json({ error: "Transaksi tidak ditemukan." }, { status: 404 });

    const result = await syncDeposit(deposit, { notifyCancel: true });
    const user = await (await usersCol()).findOne({ token }, { projection: { balance: 1 } });

    return NextResponse.json({
      status: result.status,
      credited: result.credited,
      cashback: result.credit?.cashback || 0,
      balance: user?.balance ?? 0
    });
  } catch (err) {
    console.error("[deposit/status]", err?.message || err);
    return NextResponse.json({ error: "Terjadi kesalahan server." }, { status: 500 });
  }
}
