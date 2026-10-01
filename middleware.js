// Gerbang keamanan otomatis (jalan di edge, sebelum halaman/API apa pun diproses).
//
//  • Pemindai kerentanan: alamat yang meminta berkas rahasia (.env, .git, wp-admin, phpmyadmin, …) diberi 404,
//    dan setelah 3 kali dalam 10 menit IP-nya diblokir 1 jam.
//  • Alat serang/pemindai terkenal (sqlmap, nikto, nmap, masscan, …) langsung ditolak.
//  • Banjir permintaan ke /api dari satu IP (>600 per 10 detik) dibalas 429; pengulangan membuat IP diblokir 15 menit.
//  • Webhook penyedia (Telegram, pembayaran) dan cron dikecualikan agar tidak pernah ikut terblokir.
//
// Penghitung disimpan di memori isolat edge (per wilayah) — cukup untuk menahan bot sederhana; perlindungan
// serangan skala besar tetap tugas Vercel Firewall.
import { NextResponse } from "next/server";

const batasTrafik = new Map(); // ip → { n, t0 }
const pelanggaran = new Map(); // ip → { n, t0 }
const diblokir = new Map(); // ip → sampai (ms)

const KECUALI = [/^\/api\/cron\//, /^\/api\/telegram\/webhook/, /^\/api\/bot\/webhook/, /^\/api\/deposit\/webhook/, /^\/api\/gw\/v1\/callback/];
const JALUR_PEMINDAI = /(^|\/)(\.env|\.git|\.svn|\.DS_Store|wp-admin|wp-login|wp-content|wp-includes|xmlrpc\.php|phpmyadmin|pma|cgi-bin|vendor\/phpunit|\.aws|\.ssh|id_rsa|config\.php|backup\.(sql|zip|tar)|dump\.sql|server-status)(\/|$|\.)|\.(php\d?|asp|aspx|jsp|cgi|env|bak|sql|ini|log)$/i;
const UA_BURUK = /(sqlmap|nikto|nmap|masscan|acunetix|nessus|dirbuster|gobuster|wpscan|havij|zgrab|nuclei|jaeles|openvas|netsparker|burpcollaborator)/i;

function ipDari(req) {
  const xf = req.headers.get("x-forwarded-for") || "";
  return (req.ip || xf.split(",")[0] || req.headers.get("x-real-ip") || "").trim();
}
const lokal = (ip) => !ip || ip === "unknown" || ip === "::1" || ip.startsWith("127.") || ip === "localhost";

function catat(ip, bobot = 1) {
  const now = Date.now();
  let e = pelanggaran.get(ip);
  if (!e || now - e.t0 > 10 * 60_000) e = { n: 0, t0: now };
  e.n += bobot;
  pelanggaran.set(ip, e);
  if (pelanggaran.size > 5000) pelanggaran.clear();
  return e.n;
}

function tolak(status, pesan, detik = 0, api = true) {
  const kepala = detik ? { "Retry-After": String(detik) } : {};
  if (api) return NextResponse.json({ error: pesan }, { status, headers: kepala });
  return new NextResponse(pesan, { status, headers: { "content-type": "text/plain; charset=utf-8", ...kepala } });
}

export function middleware(req) {
  const { pathname } = req.nextUrl;
  const api = pathname.startsWith("/api/");
  const ip = ipDari(req);
  const now = Date.now();

  if (!lokal(ip)) {
    const sampai = diblokir.get(ip);
    if (sampai && sampai > now) return tolak(403, "Akses diblokir sementara karena aktivitas mencurigakan.", Math.ceil((sampai - now) / 1000), api);
    if (sampai) diblokir.delete(ip);
  }

  if (UA_BURUK.test(req.headers.get("user-agent") || "")) return tolak(403, "Forbidden.", 0, api);

  if (JALUR_PEMINDAI.test(pathname)) {
    if (!lokal(ip) && catat(ip) >= 3) diblokir.set(ip, now + 60 * 60_000);
    return tolak(404, "Not found.", 0, false);
  }

  if (api && !lokal(ip) && !KECUALI.some((r) => r.test(pathname))) {
    let b = batasTrafik.get(ip);
    if (!b || now - b.t0 > 10_000) { b = { n: 0, t0: now }; batasTrafik.set(ip, b); }
    b.n += 1;
    if (batasTrafik.size > 8000) batasTrafik.clear();
    if (b.n > 600) {
      if (b.n === 601 && catat(ip) >= 3) diblokir.set(ip, now + 15 * 60_000);
      return tolak(429, "Terlalu banyak permintaan. Coba lagi sebentar.", 10, true);
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|webp|svg|gif|ico|css|js|mp3|mp4|woff2?|map|txt|xml|json|webmanifest)$).*)"]
};
