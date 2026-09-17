import { NextResponse } from "next/server";
import { depositsCol } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Kode akun kosong." }, { status: 400 });

  const deposits = await depositsCol();
  const list = await deposits
    .find({ token }, { projection: { qrImage: 0 } })
    .sort({ createdAt: -1 })
    .limit(50)
    .toArray();

  return NextResponse.json({
    items: list.map((d) => ({
      orderId: d.orderId,
      providerRef: d.providerRef && d.providerRef !== d.orderId ? d.providerRef : null,
      amount: d.amount,
      adminFee: d.adminFee ?? null,
      totalAmount: d.totalAmount ?? null,
      provider: d.provider || "pakasir",
      status: d.status,
      credited: Boolean(d.credited),
      createdAt: d.createdAt,
      expiredAt: d.expiredAt || null,
      paidAt: d.paidAt || d.creditedAt || null
    }))
  });
}
