import { NextResponse } from "next/server";
import { resolveApiKey, jsonV1 } from "@/lib/apiKeyAuth";
import { placeOtpOrder } from "@/lib/otpOrderService";

export const dynamic = "force-dynamic";

export async function POST(req) {
  const { user, error } = await resolveApiKey(req, "tulis");
  if (error) return error;

  const body = await req.json().catch(() => ({}));
  // Token selalu dari API key, tidak pernah dari body — mencegah order atas nama
  // akun lain hanya dengan menebak kode akun.
  const result = await placeOtpOrder({ ...body, token: user.token, server: body.server || "rumahotp" });
  if (!result.ok) return jsonV1(req, { error: result.error }, { status: result.status });
  return jsonV1(req, result.order);
}
