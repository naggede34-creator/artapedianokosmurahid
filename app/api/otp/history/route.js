import { NextResponse } from "next/server";
import { otpOrdersCol } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Kode akun kosong." }, { status: 400 });

  const orders = await otpOrdersCol();
  const list = await orders.find({ token }).sort({ createdAt: -1 }).limit(50).toArray();

  return NextResponse.json({
    items: list.map((o) => ({
      orderId: o.orderId,
      provider: o.provider || "rumahotp",
      serviceName: o.serviceName,
      countryName: o.countryName,
      phoneNumber: o.phoneNumber,
      price: o.price,
      status: o.status,
      otpCode: o.refunded ? null : o.otpCode,
      operatorName: o.operatorName || null,
      expiredAt: o.expiredAt || null,
      refunded: o.refunded || false,
      createdAt: o.createdAt
    }))
  });
}
