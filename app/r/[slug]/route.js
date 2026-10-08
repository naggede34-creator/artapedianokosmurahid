import { NextResponse } from "next/server";
import { webBerlaku } from "@/lib/webReseller";
import { SLUG_RE } from "@/lib/webResellerUi";
import { COOKIE_RW } from "@/lib/rwKonteks";

export const dynamic = "force-dynamic";

// Pintu masuk web reseller untuk domain TANPA wildcard: menyimpan pilihan di cookie lalu membuka beranda.
// /r/utama (atau nama yang tidak ada) mengembalikan ke web utama.
export async function GET(req, { params }) {
  const { slug } = await params;
  const s = String(slug || "").toLowerCase();
  const res = NextResponse.redirect(new URL("/", req.url), 302);
  const web = SLUG_RE.test(s) ? await webBerlaku(s).catch(() => null) : null;
  if (web) res.cookies.set(COOKIE_RW, web.slug, { path: "/", maxAge: 30 * 86400, sameSite: "lax", secure: true });
  else res.cookies.set(COOKIE_RW, "", { path: "/", maxAge: 0 });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
