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

const he = (x) => String(x ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const wr = (v, d) => (/^#[0-9a-fA-F]{3,8}$/.test(String(v || "")) ? v : d);
const urlGambar = (v) => (/^(https:\/\/[^\s"'<>]+|\/api\/ban-tampilan\/gambar\?[A-Za-z0-9=&]+)$/.test(String(v || "")) ? v : "");
const hrefAman = (v) => (/^(\/(?!\/)[A-Za-z0-9\-._~/?=&%#:+@!$()*,;]*|https:\/\/[^\s"'<>]+)$/.test(String(v || "")) ? v : "");

/** Gaya tampilan ban yang dipakai bersama halaman edge ini dan komponen React (satu sumber = tampilan identik). */
export function gayaBan(cfg) {
  const c = cfg && cfg.aktif ? cfg : {};
  const l1 = wr(c.latar1, "#3a0d14"), l2 = wr(c.latar2, "#0b0b10");
  const bgImg = urlGambar(c.gambarLatar);
  return {
    latar: `${bgImg ? `linear-gradient(rgba(0,0,0,.45),rgba(0,0,0,.65)),url("${bgImg}") center/cover no-repeat,` : ""}radial-gradient(circle at 50% 30%,${l1} 0%,${l2} 65%)`,
    teks: wr(c.warnaTeks, "#ffffff"), judul: wr(c.warnaJudul, "#ff5a67")
  };
}

/** Halaman layar penuh untuk IP yang diblokir (HTML mandiri). `cfg` = tampilan kustom dari admin (boleh kosong → bawaan). */
export function halamanBan(cfg) {
  const aktif = !!(cfg && cfg.aktif);
  const c = aktif ? cfg : {};
  const g = gayaBan(cfg);
  const judul = aktif ? (String(c.judul || "").trim() || (c.teks || c.html ? "" : PESAN_BAN)) : PESAN_BAN;
  const gambar = urlGambar(c.gambar);
  const href = hrefAman(c.tombolHref);
  const tinggi = Math.max(80, Math.min(900, Math.floor(Number(c.htmlTinggi) || 320)));
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Arta Pedia ID</title><style>html,body{margin:0;min-height:100%;background:#0b0b10;color:${g.teks};font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}main{box-sizing:border-box;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px 20px;text-align:center;background:${g.latar}}.i{font-size:64px;line-height:1}img.g{max-width:min(420px,90%);max-height:300px;border-radius:18px;object-fit:contain}h1{margin:20px 0 0;max-width:560px;font-size:clamp(20px,5vw,30px);line-height:1.35;font-weight:800;letter-spacing:.02em;color:${g.judul};text-transform:${aktif ? "none" : "uppercase"}}p{margin:14px 0 0;max-width:560px;font-size:15px;line-height:1.6;white-space:pre-line}iframe{margin-top:18px;width:min(640px,100%);border:0;border-radius:14px;background:transparent}a.t{display:inline-block;margin-top:22px;padding:12px 22px;border-radius:12px;background:${g.judul};color:#111;font-weight:800;text-decoration:none}</style></head><body><main>${gambar ? `<img class="g" src="${he(gambar)}" alt="">` : `<div class="i">🚫</div>`}${judul ? `<h1>${he(judul)}</h1>` : ""}${c.teks ? `<p>${he(c.teks)}</p>` : ""}${c.html ? `<iframe sandbox="" srcdoc="${he(c.html)}" style="height:${tinggi}px" title="Informasi"></iframe>` : ""}${href && c.tombolTeks ? `<a class="t" href="${he(href)}">${he(c.tombolTeks)}</a>` : ""}</main></body></html>`;
}
