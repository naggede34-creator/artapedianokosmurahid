// Gerbang keamanan otomatis (jalan di edge, sebelum halaman/API apa pun diproses).
//
//  • Pemindai kerentanan: alamat yang meminta berkas rahasia (.env, .git, wp-admin, phpmyadmin, …) diberi 404,
//    dan setelah 3 kali dalam 10 menit IP-nya diblokir 1 jam.
//  • Alat serang/pemindai terkenal (sqlmap, nikto, nmap, masscan, …) langsung ditolak.
//  • Banjir permintaan ke /api dari satu IP (>400 per 10 detik) dibalas 429; pengulangan membuat IP diblokir 15 menit.
//  • IP yang diblokir (otomatis saat akun di-ban, atau manual oleh admin) ditolak dari SELURUH situs dengan layar
//    "AKUN ANDA TELAH DI BANNED…". Jalur admin, webhook & cron tidak ikut (admin tak boleh terkunci). Daftarnya
//    berupa sidik bergaram yang diambil dari /api/internal/ip-blokir dan disegarkan ±10 dtk.
//  • Webhook penyedia (Telegram, pembayaran) dan cron dikecualikan agar tidak pernah ikut terblokir.
//
// Penghitung disimpan di memori isolat edge (per wilayah) — cukup untuk menahan bot sederhana; perlindungan
// serangan skala besar tetap tugas Vercel Firewall.
import { NextResponse } from "next/server";
import { normalIp, ipPribadi, sidikIp, garamIp, PESAN_BAN, halamanBan } from "@/lib/ipHash";

const batasTrafik = new Map(); // ip → { n, t0 }
const pelanggaran = new Map(); // ip → { n, t0 }
const diblokir = new Map(); // ip → sampai (ms)
const batasUang = new Map(); // "ip|jalur" → { n, t0 }

// Endpoint yang memindahkan uang / menebak kredensial: batas per-IP jauh lebih ketat daripada API biasa.
// [pola, maks per menit]
const JALUR_UANG = [
  [/^\/api\/tarik/, 20],
  [/^\/api\/game\/dompet/, 30],
  [/^\/api\/deposit\/(create|confirm)/, 20],
  [/^\/api\/transfer/, 20],
  [/^\/api\/admin\/login/, 12],
  [/^\/api\/admin\/austinpay/, 30],
  [/^\/api\/user\/(init|login)/, 30]
];

const KECUALI = [/^\/api\/cron\//, /^\/api\/telegram\/webhook/, /^\/api\/bot\/webhook/, /^\/api\/deposit\/webhook/, /^\/api\/deposit\/austinpay-webhook/, /^\/api\/gw\/v1\/callback/];
const JALUR_PEMINDAI = /(^|\/)(\.env|\.git|\.htaccess|\.htpasswd|actuator|_profiler|solr|jenkins|manager\/html|boaform|HNAP1|owa|ecp|remote\/login|\.svn|\.DS_Store|wp-admin|wp-login|wp-content|wp-includes|xmlrpc\.php|phpmyadmin|pma|cgi-bin|vendor\/phpunit|\.aws|\.ssh|id_rsa|config\.php|backup\.(sql|zip|tar)|dump\.sql|server-status)(\/|$|\.)|\.(php\d?|asp|aspx|jsp|cgi|env|bak|sql|ini|log)$/i;
const UA_BURUK = /(sqlmap|nikto|nmap|masscan|acunetix|nessus|dirbuster|gobuster|wpscan|havij|zgrab|nuclei|jaeles|openvas|netsparker|burpcollaborator)/i;

// ── IP yang diblokir (daftar sidik bergaram, disegarkan berkala dari server) ──
const SEGAR_MS = 10_000;
const blokirIp = { sidik: null, t: 0, memuat: null };
const JALUR_BEBAS_BLOKIR = [/^\/admin(\/|$)/, /^\/api\/admin(\/|$)/, /^\/api\/internal\//];

async function muatDaftarBlokir(asal) {
  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 2500);
    const r = await fetch(new URL("/api/internal/ip-blokir", asal), { cache: "no-store", signal: ac.signal });
    clearTimeout(timer);
    if (!r.ok) throw new Error(String(r.status));
    const d = await r.json();
    blokirIp.sidik = new Set(Array.isArray(d.h) ? d.h : []);
    blokirIp.t = Date.now();
  } catch {
    // Gagal baca: pertahankan daftar lama (atau kosong) dan coba lagi sebentar lagi — situs tidak boleh mati karena ini.
    if (!blokirIp.sidik) blokirIp.sidik = new Set();
    blokirIp.t = Date.now() - SEGAR_MS + 5_000;
  } finally { blokirIp.memuat = null; }
}

async function ipDiblokir(req, ip) {
  const n = normalIp(ip);
  if (!n || ipPribadi(n)) return false;
  // Daftar basi → ditunggu sebentar (satu fetch per isolat per ±10 dtk) supaya IP yang BARU diblokir tidak lolos.
  if (!blokirIp.sidik || Date.now() - blokirIp.t > SEGAR_MS) {
    blokirIp.memuat = blokirIp.memuat || muatDaftarBlokir(req.nextUrl.origin);
    await blokirIp.memuat;
  }
  if (!blokirIp.sidik.size) return false;
  return blokirIp.sidik.has(await sidikIp(n, garamIp()));
}

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

export async function middleware(req) {
  const { pathname } = req.nextUrl;
  const api = pathname.startsWith("/api/");
  const ip = ipDari(req);
  const now = Date.now();

  if (!lokal(ip)) {
    const sampai = diblokir.get(ip);
    if (sampai && sampai > now) return tolak(403, "Akses diblokir sementara karena aktivitas mencurigakan.", Math.ceil((sampai - now) / 1000), api);
    if (sampai) diblokir.delete(ip);
  }

  if (!lokal(ip) && !JALUR_BEBAS_BLOKIR.some((r) => r.test(pathname)) && !KECUALI.some((r) => r.test(pathname)) && (await ipDiblokir(req, ip))) {
    const kepala = { "cache-control": "no-store", "x-diblokir": "1" };
    if (api) return NextResponse.json({ error: PESAN_BAN, diblokir: true }, { status: 403, headers: kepala });
    return new NextResponse(halamanBan(), { status: 403, headers: { ...kepala, "content-type": "text/html; charset=utf-8" } });
  }

  if (UA_BURUK.test(req.headers.get("user-agent") || "")) return tolak(403, "Forbidden.", 0, api);

  if (JALUR_PEMINDAI.test(pathname)) {
    if (!lokal(ip) && catat(ip) >= 3) diblokir.set(ip, now + 60 * 60_000);
    return tolak(404, "Not found.", 0, false);
  }

  // Admin: permintaan yang MENGUBAH data wajib berasal dari situs sendiri (tolak lintas-asal — pertahanan CSRF tambahan
  // di atas cookie SameSite). Permintaan tanpa header Origin (alat server-ke-server, uji) tetap diizinkan.
  if (api && pathname.startsWith("/api/admin/") && req.method !== "GET" && req.method !== "HEAD" && req.method !== "OPTIONS") {
    const asal = req.headers.get("origin");
    if (asal) {
      let sama = false;
      try { sama = new URL(asal).host === req.nextUrl.host || new URL(asal).host === req.headers.get("host"); } catch {}
      if (!sama) return tolak(403, "Asal permintaan tidak diizinkan.", 0, true);
    }
  }

  if (api && !lokal(ip) && req.method !== "GET") {
    const aturan = JALUR_UANG.find(([r]) => r.test(pathname));
    if (aturan) {
      const k = `${ip}|${aturan[0].source}`;
      let b = batasUang.get(k);
      if (!b || now - b.t0 > 60_000) { b = { n: 0, t0: now }; batasUang.set(k, b); }
      b.n += 1;
      if (batasUang.size > 8000) batasUang.clear();
      if (b.n > aturan[1]) {
        if (b.n === aturan[1] + 1 && catat(ip, 1) >= 4) diblokir.set(ip, now + 15 * 60_000);
        return tolak(429, "Terlalu banyak permintaan ke layanan ini. Tunggu sebentar.", 30, true);
      }
    }
  }

  if (api && !lokal(ip) && !KECUALI.some((r) => r.test(pathname))) {
    let b = batasTrafik.get(ip);
    if (!b || now - b.t0 > 10_000) { b = { n: 0, t0: now }; batasTrafik.set(ip, b); }
    b.n += 1;
    if (batasTrafik.size > 8000) batasTrafik.clear();
    if (b.n > 400) {
      if (b.n === 401 && catat(ip) >= 3) diblokir.set(ip, now + 15 * 60_000);
      return tolak(429, "Terlalu banyak permintaan. Coba lagi sebentar.", 10, true);
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|webp|svg|gif|ico|css|js|mp3|mp4|woff2?|map|txt|xml|json|webmanifest)$).*)"]
};
