import { NextResponse } from "next/server";
import { ADMIN_COOKIE, ADMIN_COOKIE_VALUE, getAdminCode } from "@/lib/adminAuth";

export async function POST(req) {
  try {
    const { code } = await req.json().catch(() => ({}));
    if (!code || String(code) !== getAdminCode()) {
      return NextResponse.json({ error: "Kode admin salah." }, { status: 401 });
    }

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
