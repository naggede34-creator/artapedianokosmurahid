// Dipanggil tiap 10 menit oleh cron eksternal atau Vercel Cron (juga otomatis dari /api/cron/tick & lalu lintas web).
// Mendeteksi pola mencurigakan dan membekukan akun bermasalah. Logikanya di lib/keamanan.js.
// GET /api/cron/security-scan?secret=CRON_SECRET
import { NextResponse } from "next/server";
import { pindaiKeamanan } from "@/lib/keamanan";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function isAuthorized(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = req.headers.get("authorization") || "";
  if (auth === `Bearer ${secret}`) return true;
  return new URL(req.url).searchParams.get("secret") === secret;
}

export async function GET(req) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const hasil = await pindaiKeamanan({ kabarBersih: true });
    return NextResponse.json({ ok: true, flagged: hasil.flagged, autoSuspended: hasil.ditangguhkan, flags: hasil.temuan });
  } catch (err) {
    console.error("[security-scan]", err);
    return NextResponse.json({ error: "Security scan gagal.", detail: err?.message }, { status: 500 });
  }
}
