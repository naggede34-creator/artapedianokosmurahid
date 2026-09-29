import { NextResponse } from "next/server";
import { ADMIN_COOKIE, adminCodeMatches, adminCodeIsDefault, createAdminSession, adminCookieOptions } from "@/lib/adminAuth";
import { sendMonitorLog, adminLoginLog } from "@/lib/monitor";
import { rateLimit } from "@/lib/rateLimit";

export async function POST(req) {
  try {
    const { code } = await req.json().catch(() => ({}));
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;

    if (!rateLimit(`${ip || "unknown"}:admin-login`, 3, 5 * 60_000)) {
      return NextResponse.json({ error: "Terlalu banyak percobaan. Coba lagi dalam 5 menit." }, { status: 429 });
    }

    if (!code || !(await adminCodeMatches(code))) {
      sendMonitorLog(adminLoginLog({ success: false, ip }));
      return NextResponse.json({ error: "Kode admin salah." }, { status: 401 });
    }

    sendMonitorLog(adminLoginLog({ success: true, ip }));

    const masihBawaan = await adminCodeIsDefault();
    if (masihBawaan) {
      // Kode bawaan tertulis di repositori, jadi ia bukan rahasia siapa pun.
      console.warn("[admin] Kode admin belum diisi (web maupun Vercel) — panel admin memakai kode bawaan yang ada di kode sumber.");
    }

    const res = NextResponse.json({ ok: true, defaultCode: masihBawaan });
    res.cookies.set(ADMIN_COOKIE, await createAdminSession(), adminCookieOptions());
    return res;
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Terjadi kesalahan server." }, { status: 500 });
  }
}
