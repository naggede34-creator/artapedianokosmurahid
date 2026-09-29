// Perekat rute /api/wa/*: autentikasi, pembatasan laju, bentuk jawaban.
import { NextResponse } from "next/server";
import { masuk, denyut } from "@/lib/wa/inti";
import { rateLimit } from "@/lib/rateLimit";

export const j = (data, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
export const galat = (alasan, status = 400, ekstra = {}) => j({ error: alasan, ...ekstra }, status);

/** Token dari query atau body → profil. Tanpa token sah: null. */
export async function auth(req, body = null) {
  const t = new URL(req.url).searchParams.get("token") || body?.token || req.headers.get("x-token");
  const me = await masuk(t);
  if (!me) return null;
  denyut(me).catch(() => {});
  return me;
}

export const tolakAuth = () => galat("Masuk dulu untuk memakai Room Chat.", 401, { perluMasuk: true });

/** Batas laju per profil. true = boleh. */
export const batasi = (me, kunci, maks, jendelaMs) => rateLimit(`wa:${me.pid}:${kunci}`, maks, jendelaMs);
export const terlaluCepat = () => galat("Terlalu cepat. Tunggu sebentar ya.", 429);

export async function bacaBody(req) {
  return req.json().catch(() => ({}));
}
