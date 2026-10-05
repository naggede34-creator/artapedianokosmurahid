// Dipanggil tiap 10 menit oleh cron eksternal atau Vercel Cron (juga otomatis dari /api/cron/tick & lalu lintas web).
// Mendeteksi pola mencurigakan dan membekukan akun bermasalah. Logikanya di lib/keamanan.js.
// GET /api/cron/security-scan?secret=CRON_SECRET
import { NextResponse } from "next/server";
import { cronSah } from "@/lib/cronAuth";
import { pindaiKeamanan } from "@/lib/keamanan";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

async function isAuthorized(req) {
  return cronSah(req);
}

export async function GET(req) {
  if (!(await isAuthorized(req))) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const hasil = await pindaiKeamanan({ kabarBersih: true });
    return NextResponse.json({ ok: true, flagged: hasil.flagged, autoSuspended: hasil.ditangguhkan, flags: hasil.temuan });
  } catch (err) {
    console.error("[security-scan]", err);
    return NextResponse.json({ error: "Security scan gagal.", detail: err?.message }, { status: 500 });
  }
}
