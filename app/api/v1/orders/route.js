import { NextResponse } from "next/server";
import { resolveApiKey } from "@/lib/apiKeyAuth";
import { otpOrdersCol } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const { user, error } = await resolveApiKey(req);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
  const page = Math.max(parseInt(searchParams.get("page") || "1", 10), 1);
  const skip = (page - 1) * limit;

  const orders = await otpOrdersCol();
  const list = await orders
    .find({ token: user.token })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .toArray();

  return NextResponse.json({
    page,
    limit,
    items: list.map((o) => ({
      orderId: o.orderId,
      serviceName: o.serviceName,
      countryName: o.countryName,
      phoneNumber: o.phoneNumber,
      price: o.price,
      status: o.status,
      otpCode: o.refunded ? null : o.otpCode,
      refunded: o.refunded || false,
      createdAt: o.createdAt
    }))
  });
}
