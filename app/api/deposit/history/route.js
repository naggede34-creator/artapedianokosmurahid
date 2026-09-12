import { NextResponse } from "next/server";
import { depositsCol } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Kode akun kosong." }, { status: 400 });

  const deposits = await depositsCol();
  const list = await deposits
    .find({ token })
    .sort({ createdAt: -1 })
    .limit(50)
    .toArray();

  return NextResponse.json({
    items: list.map((d) => ({
      orderId: d.orderId,
      amount: d.amount,
      status: d.status,
      createdAt: d.createdAt
    }))
  });
}
