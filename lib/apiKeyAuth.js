import { usersCol } from "@/lib/db";
import { NextResponse } from "next/server";

export function getApiKeyFromReq(req) {
  const auth = req.headers.get("authorization") || "";
  if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return new URL(req.url).searchParams.get("api_key") || null;
}

export async function resolveApiKey(req) {
  const apiKey = getApiKeyFromReq(req);
  if (!apiKey) {
    return { user: null, error: NextResponse.json({ error: "API key required. Send via Authorization: Bearer <key> header." }, { status: 401 }) };
  }
  if (apiKey.length !== 32) {
    return { user: null, error: NextResponse.json({ error: "Invalid API key format." }, { status: 401 }) };
  }
  const col = await usersCol();
  const user = await col.findOne({ apiKey }, { projection: { token: 1, balance: 1, name: 1, joinedAt: 1, suspended: 1, suspendReason: 1 } });
  if (!user) {
    return { user: null, error: NextResponse.json({ error: "API key not found or revoked." }, { status: 401 }) };
  }
  if (user.suspended) {
    return { user: null, error: NextResponse.json({ error: `Account suspended: ${user.suspendReason || "Contact support."}` }, { status: 403 }) };
  }
  return { user, error: null };
}
