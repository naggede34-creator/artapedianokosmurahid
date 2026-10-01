import { NextResponse } from "next/server";
import { resolveApiKey, jsonV1 } from "@/lib/apiKeyAuth";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const { user, error } = await resolveApiKey(req);
  if (error) return error;

  return jsonV1(req, {
    name: user.name || null,
    balance: user.balance ?? 0,
    joinedAt: user.joinedAt || null
  });
}
