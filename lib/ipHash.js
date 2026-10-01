// Pembantu IP yang dipakai BERSAMA oleh middleware (edge) dan kode server: tanpa impor Node/Mongo.
//
// Daftar IP yang diblokir tidak pernah dikirim mentah ke edge — hanya sidik SHA-256 bergaram, jadi alamat IP
// pengguna tidak bocor lewat endpoint daftar itu.

/** Menyeragamkan IP: IPv4-mapped → IPv4; IPv6 → awalan /64 (satu pelanggan biasanya memegang seluruh /64). */
export function normalIp(mentah) {
  let ip = String(mentah || "").trim().toLowerCase();
  if (!ip || ip === "unknown") return "";
  if (/^[0-9a-f:]+::\/64$/.test(ip)) return ip; // sudah berbentuk awalan /64 (idempoten)
  if (ip.startsWith("::ffff:") && ip.includes(".")) ip = ip.slice(7);
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return ip.split(".").every((x) => Number(x) <= 255) ? ip : "";
  if (ip.includes(":") && /^[0-9a-f:]+$/.test(ip)) {
    const [kiri, kanan = null] = ip.split("::");
    const a = kiri ? kiri.split(":") : [];
    const b = kanan === null ? [] : kanan ? kanan.split(":") : [];
    const isi = kanan === null ? a : [...a, ...Array(Math.max(0, 8 - a.length - b.length)).fill("0"), ...b];
    if (isi.length !== 8) return "";
    return `${isi.slice(0, 4).map((g) => g.replace(/^0+(?=.)/, "")).join(":")}::/64`;
  }
  return "";
}

/** IP yang tidak boleh diblokir: loopback & jaringan pribadi (bukan alamat pengunjung sungguhan). */
export function ipPribadi(ip) {
  if (!ip) return true;
  if (ip.includes(":")) return /^(0:0:0:0|fc|fd|fe8|fe9|fea|feb)/.test(ip) || ip.startsWith("0:0:0:0:");
  const [a, b] = ip.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) || (a === 169 && b === 254);
}

/** Sidik bergaram: SHA-256(garam|ip) → 16 heksa pertama. */
export async function sidikIp(ip, garam) {
  const data = new TextEncoder().encode(`${garam}|${ip}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf).slice(0, 8), (x) => x.toString(16).padStart(2, "0")).join("");
}

export const garamIp = () => String(process.env.IP_BLOK_GARAM || process.env.MONGODB_URI || process.env.MONGO_URI || "artapedia-ip");

export const PESAN_BAN = "AKUN ANDA TELAH DI BANNED ADMIN KARENA TELAH MELANGGAR KETENTUAN ARTA PEDIA ID";

/** Halaman layar penuh untuk IP yang diblokir (HTML mandiri: tidak butuh aset/skrip apa pun dari situs). */
export function halamanBan() {
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Arta Pedia ID</title><style>html,body{margin:0;height:100%;background:#0b0b10;color:#fff;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}main{min-height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px;text-align:center;background:radial-gradient(circle at 50% 30%,#3a0d14 0%,#0b0b10 65%)}.i{font-size:64px;line-height:1}h1{margin:20px 0 0;max-width:560px;font-size:clamp(20px,5vw,30px);line-height:1.35;font-weight:800;letter-spacing:.02em;color:#ff5a67;text-transform:uppercase}</style></head><body><main><div class="i">🚫</div><h1>${PESAN_BAN}</h1></main></body></html>`;
}
