import { rwDariReq } from "@/lib/rwKonteks";
import { webBerlaku } from "@/lib/webReseller";
import { SLUG_RE } from "@/lib/webResellerUi";

export const dynamic = "force-dynamic";

// Ikon web reseller: huruf awal nama merek di atas warna yang diturunkan dari namanya (tanpa logo Arta Pedia).
export async function GET(req) {
  // Gambar <img> tidak bisa membawa header: webnya boleh dipilih lewat ?s=nama.
  const s = String(new URL(req.url).searchParams.get("s") || "").toLowerCase();
  const web = (await rwDariReq(req)) || (SLUG_RE.test(s) ? await webBerlaku(s).catch(() => null) : null);
  const nama = (web?.nama || "?").trim();
  const huruf = (nama[0] || "?").toUpperCase().replace(/[<>&"']/g, "");
  let h = 0;
  for (const c of nama) h = (h * 31 + c.charCodeAt(0)) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="hsl(${h} 70% 42%)"/><text x="256" y="256" text-anchor="middle" dominant-baseline="central" font-family="Arial,Helvetica,sans-serif" font-weight="800" font-size="300" fill="#fff">${huruf}</text></svg>`;
  return new Response(svg, { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "private, max-age=300", "Vary": "Cookie, Host", "X-Content-Type-Options": "nosniff" } });
}
