import { NextResponse } from "next/server";
import { placeOtpOrder } from "@/lib/otpOrderService";

export const dynamic = "force-dynamic";

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const result = await placeOtpOrder(body);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result.order);
}
