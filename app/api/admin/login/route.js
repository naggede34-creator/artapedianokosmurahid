import { NextResponse } from "next/server";
import { ADMIN_COOKIE, ADMIN_COOKIE_VALUE, getAdminCode } from "@/lib/adminAuth";
import { sendMonitorLog, adminLoginLog } from "@/lib/monitor";
import { rateLimit } from "@/lib/rateLimit";

export async function POST(req) {
  try {
    const { code } = await req.json().catch(() => ({}));
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;

    if (!rateLimit(`${ip || "unknown"}:admin-login`, 3, 5 * 60_000)) {
      return NextResponse.json({ error: "Terlalu banyak percobaan. Coba lagi dalam 5 menit." }, { status: 429 });
    }

    if (!code || String(code) !== await getAdminCode()) {
      sendMonitorLog(adminLoginLog({ success: false, ip }));
      return NextResponse.json({ error: "Kode admin salah." }, { status: 401 });
    }

    sendMonitorLog(adminLoginLog({ success: true, ip }));

    const res = NextResponse.json({ ok: true });
    res.cookies.set(ADMIN_COOKIE, ADMIN_COOKIE_VALUE, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7 // 7 hari
    });
    return res;
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Terjadi kesalahan server." }, { status: 500 });
  }
}
