import { NextResponse } from "next/server";
import { bacaLogo } from "@/lib/logo";

export const dynamic = "force-dynamic";

// Varian → [slot, berkas bawaan]. Unggahan admin disajikan apa adanya untuk semua varian slotnya.
const VARIAN = {
  utama: ["utama", "/logo.svg"],
  "utama-png": ["utama", "/logo.png"],
  ikon: ["ikon", "/logo-mark.png"],
  "ikon-svg": ["ikon", "/logo-mark.svg"],
  "ikon-192": ["ikon", "/icon-192.png"],
  "ikon-512": ["ikon", "/icon-512.png"],
  "ikon-maskable": ["ikon", "/icon-maskable.png"]
};

export async function GET(req, { params }) {
  const { jenis } = await params;
  const v = VARIAN[jenis];
  if (!v) return new NextResponse("Not found", { status: 404 });
  let logo = null;
  try { logo = await bacaLogo(v[0]); } catch {}
  if (!logo) {
    return NextResponse.redirect(new URL(v[1], req.url), { status: 307, headers: { "Cache-Control": "public, max-age=60" } });
  }
  return new NextResponse(logo.buf, {
    headers: {
      "Content-Type": logo.tipe,
      "Cache-Control": "public, max-age=300, must-revalidate",
      "X-Content-Type-Options": "nosniff",
      // SVG yang dibuka langsung di tab tidak boleh menjalankan apa pun.
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox"
    }
  });
}
