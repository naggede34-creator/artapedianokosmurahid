// Blokir IP bersama akun yang di-ban.
//
// Saat akun dibekukan (manual lewat dasbor admin, atau otomatis oleh anti-curang/keamanan), semua IP yang pernah
// dipakai akun itu dimasukkan ke `ip_blokir`. Middleware (edge) menolak SEMUA halaman & API dari IP tersebut dengan layar
// "AKUN ANDA TELAH DI BANNED…", kecuali jalur admin (supaya admin tak bisa terkunci), webhook penyedia & cron.
// Saat akunnya dibuka blokirnya, IP yang hanya terikat ke akun itu dilepas lagi.
//
// Batas yang jujur: IP bisa berganti (VPN, data seluler) dan IP bersama (WiFi umum, CGNAT) bisa mengenai orang lain.
// Karena itu ada saklar BLOKIR_IP_SAAT_BAN dan admin bisa membuka IP satu per satu.
import { usersCol, perangkatCol, ipBlokirCol } from "@/lib/db";
import { cfg } from "@/lib/config";
import { normalIp, ipPribadi, sidikIp, garamIp } from "@/lib/ipHash";

const MAKS_IP_AKUN = 15;
const MAKS_DAFTAR = 20000;

export const ipDariReq = (req) => {
  const h = req.headers;
  return normalIp(String(h.get("x-forwarded-for") || "").split(",")[0] || h.get("x-real-ip") || "");
};

const aktif = async () => String((await cfg("BLOKIR_IP_SAAT_BAN")) ?? "1") !== "0";

// ───────────── catatan IP tiap akun ─────────────
const terakhirIp = new Map(); // token → { ip, t }
/** Mengingat IP yang dipakai akun (dipanggil saat akun membuka situs). Hemat tulis: hanya bila IP berubah / >30 menit. */
export async function catatIpAkun(token, ipMentah) {
  const ip = normalIp(ipMentah);
  if (!token || !ip || ipPribadi(ip)) return;
  const c = terakhirIp.get(token);
  const now = Date.now();
  if (c && c.ip === ip && now - c.t < 30 * 60_000) return;
  terakhirIp.set(token, { ip, t: now });
  if (terakhirIp.size > 5000) terakhirIp.clear();
  try {
    const kol = await usersCol();
    await kol.updateOne({ token, ipAkun: { $ne: ip } }, { $push: { ipAkun: { $each: [ip], $slice: -MAKS_IP_AKUN } } });
    await kol.updateOne({ token }, { $set: { ipTerakhir: ip, ipTerakhirAt: new Date() } });
  } catch (err) { console.error("[blokirIp] catat:", err?.message || err); }
}

/** Semua IP yang pernah dipakai akun (jejak situs + jejak game), sudah dinormalkan & tanpa IP pribadi. */
export async function ipAkun(token) {
  const u = await (await usersCol()).findOne({ token }, { projection: { ipAkun: 1, ipTerakhir: 1 } });
  const semua = new Set([...(u?.ipAkun || []), u?.ipTerakhir].map(normalIp).filter(Boolean));
  try {
    const baris = await (await perangkatCol()).find({ token }).limit(50).toArray();
    for (const b of baris) for (const x of [b.ip, ...(b.ips || [])]) { const n = normalIp(x); if (n) semua.add(n); }
  } catch {}
  return [...semua].filter((x) => !ipPribadi(x));
}

// ───────────── blokir / buka ─────────────
/** Memblokir semua IP akun (+ `tambahan`). Mengembalikan daftar IP yang diblokir. Aman dipanggil berulang. */
export async function blokirIpAkun(token, alasan = "Akun di-ban", tambahan = []) {
  try {
    if (!(await aktif())) return [];
    const daftar = new Set(await ipAkun(token));
    for (const x of [].concat(tambahan)) { const n = normalIp(x); if (n && !ipPribadi(n)) daftar.add(n); }
    const kol = await ipBlokirCol();
    const ket = String(alasan || "").slice(0, 200);
    for (const ip of daftar) {
      await kol.updateOne({ _id: ip }, { $set: { ip, alasan: ket, at: new Date() }, $addToSet: { tokens: token } }, { upsert: true });
    }
    resetCache();
    return [...daftar];
  } catch (err) { console.error("[blokirIp] blokir:", err?.message || err); return []; }
}

/** Melepas IP yang terikat ke akun ini. IP yang juga dipicu akun lain (yang masih di-ban) tetap diblokir. */
export async function bukaIpAkun(token) {
  try {
    const kol = await ipBlokirCol();
    const baris = await kol.find({ tokens: token }).limit(200).toArray();
    const dibuka = [];
    for (const b of baris) {
      const sisa = (b.tokens || []).filter((t) => t !== token);
      if (sisa.length) await kol.updateOne({ _id: b._id }, { $set: { tokens: sisa } });
      else { await kol.deleteOne({ _id: b._id }); dibuka.push(b._id); }
    }
    resetCache();
    return dibuka;
  } catch (err) { console.error("[blokirIp] buka:", err?.message || err); return []; }
}

/** Blokir/buka manual satu IP (dari dasbor admin). */
export async function blokirIpManual(ipMentah, alasan = "Diblokir admin") {
  const ip = normalIp(ipMentah);
  if (!ip) return { ok: false, alasan: "Format IP tidak valid." };
  if (ipPribadi(ip)) return { ok: false, alasan: "IP lokal/pribadi tidak bisa diblokir." };
  await (await ipBlokirCol()).updateOne({ _id: ip }, { $set: { ip, alasan: String(alasan || "Diblokir admin").slice(0, 200), at: new Date(), manual: true } }, { upsert: true });
  resetCache();
  return { ok: true, ip };
}
export async function bukaIpManual(ipMentah) {
  const ip = normalIp(ipMentah) || String(ipMentah || "").trim();
  const r = await (await ipBlokirCol()).deleteOne({ _id: ip });
  resetCache();
  return r.deletedCount ? { ok: true, ip } : { ok: false, alasan: "IP itu tidak ada di daftar blokir." };
}
export async function daftarIpBlokir() {
  return (await ipBlokirCol()).find({}).sort({ at: -1 }).limit(500).toArray();
}

// ───────────── daftar untuk middleware ─────────────
let cache = { t: 0, sidik: null };
const resetCache = () => { cache = { t: 0, sidik: null }; };
/** Sidik bergaram semua IP yang diblokir (dibaca middleware tiap ±10 dtk). */
export async function daftarSidikIp() {
  if (cache.sidik && Date.now() - cache.t < 8_000) return cache.sidik;
  const garam = garamIp();
  const baris = await (await ipBlokirCol()).find({}, { projection: { _id: 1 } }).limit(MAKS_DAFTAR).toArray();
  const sidik = await Promise.all(baris.map((b) => sidikIp(String(b._id), garam)));
  cache = { t: Date.now(), sidik };
  return sidik;
}
