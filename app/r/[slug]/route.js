import { webBerlaku } from "@/lib/webReseller";
import { SLUG_RE } from "@/lib/webResellerUi";
import { KUNCI_RW } from "@/lib/rwKonteks";

export const dynamic = "force-dynamic";

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Pintu masuk web reseller untuk domain TANPA wildcard. Halaman kecil ini hanya mengingat pilihan di SESSIONSTORAGE tab
// ini (bukan cookie), lalu membuka beranda web reseller. Tab lain tetap web utama. Pratinjau tautan (WhatsApp/Telegram)
// membaca judulnya, jadi bermerek reseller. /r/utama (atau nama yang tidak ada) mengembalikan tab ini ke web utama.
export async function GET(req, { params }) {
  const { slug } = await params;
  const s = String(slug || "").toLowerCase();
  const web = SLUG_RE.test(s) ? await webBerlaku(s).catch(() => null) : null;
  const tujuan = web ? "/dashboard" : "/";
  const nama = web ? web.nama : "";
  const html = `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(nama || "Memuat…")}</title>
${web ? `<meta property="og:title" content="${esc(nama)} — Nokos Termurah dan Fast"><meta property="og:description" content="Beli nomor OTP murah &amp; cepat, deposit QRIS otomatis 24 jam.">` : ""}
<meta name="robots" content="noindex"></head><body style="font-family:system-ui,sans-serif;text-align:center;padding:48px 16px;color:#0f1e3c;background:#f3f8ff">
<p>Membuka ${esc(nama || "web")}…</p><p><a href="${tujuan}">Klik di sini jika tidak otomatis</a></p>
<script>try{${web ? `sessionStorage.setItem(${JSON.stringify(KUNCI_RW)},${JSON.stringify(web.slug)})` : `sessionStorage.removeItem(${JSON.stringify(KUNCI_RW)})`}}catch(e){}location.replace(${JSON.stringify(tujuan)});</script></body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
