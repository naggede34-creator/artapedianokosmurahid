// Jejak perangkat & IP tiap akun (satu dokumen per pasangan akun+perangkat).
// Dipakai pemindai keamanan (satu perangkat banyak akun) dan pemblokiran IP saat akun di-ban.
import { perangkatCol } from "@/lib/db";

// ───────────────────────── PERANGKAT ─────────────────────────
/** Membaca sidik perangkat & IP dari permintaan. */
export function bacaPerangkat(req) {
  const h = req.headers;
  const mentah = String(h.get("x-perangkat") || "");
  const [dev, fp] = mentah.split(".");
  const ip = String(h.get("x-forwarded-for") || "").split(",")[0].trim() || String(h.get("x-real-ip") || "");
  return {
    dev: /^[a-f0-9]{16,48}$/.test(dev || "") ? dev : null,
    fp: /^[a-f0-9]{8,20}$/.test(fp || "") ? fp : null,
    ip: ip.slice(0, 64) || null,
    ada: !!mentah
  };
}

const terakhirCatat = new Map(); // kunci → { ip, fp, t }: menghemat tulis ke DB
/** Mencatat (akun, perangkat, IP) — hanya menulis bila berubah atau sudah >10 menit. */
export async function catatPerangkat(token, info) {
  if (!token || !info || (!info.dev && !info.ip)) return;
  const kunci = `${token}|${info.dev || "-"}`;
  const c = terakhirCatat.get(kunci);
  const now = Date.now();
  if (c && c.ip === info.ip && c.fp === info.fp && now - c.t < 10 * 60_000) return;
  terakhirCatat.set(kunci, { ip: info.ip, fp: info.fp, t: now });
  if (terakhirCatat.size > 5000) terakhirCatat.clear();
  try {
    const kol = await perangkatCol();
    const ubah = { $set: { token, dev: info.dev, fp: info.fp, ip: info.ip, lastAt: new Date() }, $setOnInsert: { firstAt: new Date() }, $inc: { n: 1 } };
    if (info.ip && !(c && c.ip === info.ip)) ubah.$push = { ips: { $each: [info.ip], $slice: -25 } };
    await kol.updateOne({ kunci }, ubah, { upsert: true });
  } catch (err) {
    if (err?.code !== 11000) console.error("[perangkat] catat:", err?.message || err);
  }
}
