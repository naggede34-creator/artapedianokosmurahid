import { NextResponse } from "next/server";
import { ADMIN_COOKIE, adminSah, createAdminSession, adminCookieOptions } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

// POST → bila sesi admin masih sah, terbitkan cookie baru dengan umur penuh (sesi "bergeser": tidak habis selama dipakai).
export async function POST(req) {
  if (!(await adminSah(req))) return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const res = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  res.cookies.set(ADMIN_COOKIE, await createAdminSession(), adminCookieOptions());
  return res;
}
