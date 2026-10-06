import { NextResponse } from "next/server";
import { ADMIN_COOKIE, peranAdmin, createAdminSession, createAdminSessionAkun, adminCookieOptions } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

// POST → bila sesi admin masih sah, terbitkan cookie baru dengan umur penuh (sesi "bergeser": tidak habis selama dipakai).
export async function POST(req) {
  const s = await peranAdmin(req);
  if (!s) return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const res = NextResponse.json({ ok: true, peran: s.peran, ...(s.nama ? { nama: s.nama } : {}) }, { headers: { "Cache-Control": "no-store" } });
  res.cookies.set(ADMIN_COOKIE, s.id ? await createAdminSessionAkun(s.id) : await createAdminSession(), adminCookieOptions());
  return res;
}
