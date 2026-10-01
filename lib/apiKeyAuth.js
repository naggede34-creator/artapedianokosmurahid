import { usersCol } from "@/lib/db";
import { NextResponse } from "next/server";
import { rateLimitInfo } from "@/lib/rateLimit";

// Batas API key Artapedia (per key, jendela 60 detik). Tercantum di dokumentasi /api-docs#ratelimit.
export const BATAS_API = {
  umum: { limit: 60, windowMs: 60_000 }, // semua endpoint v1 (baca)
  tulis: { limit: 20, windowMs: 60_000 }, // POST /v1/order
  deposit: { limit: 6, windowMs: 60_000 } // POST /v1/deposit (membuat QRIS)
};

const infoPerRequest = new WeakMap();

export function getApiKeyFromReq(req) {
  const auth = req.headers.get("authorization") || "";
  if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return new URL(req.url).searchParams.get("api_key") || null;
}

/** Header standar batas: X-RateLimit-Limit / -Remaining / -Reset (detik epoch). */
export function headerBatas(rl) {
  if (!rl) return {};
  return {
    "X-RateLimit-Limit": String(rl.limit),
    "X-RateLimit-Remaining": String(rl.sisa),
    "X-RateLimit-Reset": String(Math.ceil(rl.resetAt / 1000))
  };
}

/** Respons JSON endpoint v1 yang otomatis memuat header batas dari resolveApiKey pada request yang sama. */
export function jsonV1(req, body, init = {}) {
  const rl = infoPerRequest.get(req);
  return NextResponse.json(body, { ...init, headers: { ...(init.headers || {}), ...headerBatas(rl) } });
}

/**
 * Memeriksa API key + batas laju.
 * @param kelompok kunci di BATAS_API (bawaan "umum"); batas "umum" selalu ikut dihitung.
 */
export async function resolveApiKey(req, kelompok = "umum") {
  const apiKey = getApiKeyFromReq(req);
  if (!apiKey) {
    return { user: null, error: NextResponse.json({ error: "API key required. Send via Authorization: Bearer <key> header." }, { status: 401 }) };
  }
  if (apiKey.length !== 32 || !/^[0-9a-f]{32}$/i.test(apiKey)) {
    return { user: null, error: NextResponse.json({ error: "Invalid API key format." }, { status: 401 }) };
  }

  // Batas laju dihitung SEBELUM menyentuh database, supaya banjir permintaan tidak membebani DB.
  // Kuncinya cuplikan key (bukan key utuh) agar tidak tersimpan jelas di memori/log.
  const kunci = apiKey.slice(0, 12);
  const umum = rateLimitInfo(`apikey:${kunci}:umum`, BATAS_API.umum.limit, BATAS_API.umum.windowMs);
  let rl = umum;
  if (umum.ok && kelompok !== "umum") {
    const b = BATAS_API[kelompok] || BATAS_API.umum;
    const khusus = rateLimitInfo(`apikey:${kunci}:${kelompok}`, b.limit, b.windowMs);
    if (!khusus.ok || khusus.sisa < umum.sisa) rl = khusus;
    if (!khusus.ok) rl = { ...khusus, ok: false };
  }
  if (!rl.ok) {
    const detik = Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000));
    return {
      user: null,
      error: NextResponse.json(
        { error: `Rate limit exceeded: maks ${rl.limit} request per menit untuk API key ini. Coba lagi dalam ${detik} detik.`, retryAfter: detik },
        { status: 429, headers: { ...headerBatas(rl), "Retry-After": String(detik) } }
      )
    };
  }
  infoPerRequest.set(req, rl);

  const col = await usersCol();
  const user = await col.findOne({ apiKey }, { projection: { token: 1, balance: 1, name: 1, joinedAt: 1, suspended: 1, suspendReason: 1 } });
  if (!user) {
    return { user: null, error: NextResponse.json({ error: "API key not found or revoked." }, { status: 401 }) };
  }
  if (user.suspended) {
    return { user: null, error: NextResponse.json({ error: `Account suspended: ${user.suspendReason || "Contact support."}` }, { status: 403 }) };
  }
  return { user, error: null, rl };
}
