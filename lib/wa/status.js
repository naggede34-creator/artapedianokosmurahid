// Status (SW): teks berlatar warna atau gambar, hilang sendiri setelah 24 jam.
import { randomUUID } from "node:crypto";
import { waStatusCol, waProfilCol } from "@/lib/db";
import { BATAS, ALASAN_NAMA, perluNama, bersihTeks, petaProfil, simpanMedia, publik } from "@/lib/wa/inti";

export const STATUS_TTL_MS = 24 * 3600_000;
export const LATAR_STATUS = ["#f77c22", "#2e86ff", "#ec4899", "#16a34a", "#8b5cf6", "#ef4444", "#14b8a6", "#eab308", "#171717"];

export async function buatStatus(me, { jenis = "teks", teks = "", latar, gambar }) {
  if (perluNama(me)) return { ok: false, alasan: ALASAN_NAMA };
  const kol = await waStatusCol();
  const punya = await kol.countDocuments({ pid: me.pid, expireAt: { $gt: new Date() } });
  if (punya >= 20) return { ok: false, alasan: "Maksimal 20 status aktif." };
  const sekarang = new Date();
  const doc = {
    statusId: randomUUID(), pid: me.pid, jenis: jenis === "gambar" ? "gambar" : "teks", teks: bersihTeks(teks, 700),
    latar: LATAR_STATUS.includes(latar) ? latar : LATAR_STATUS[0], dilihat: [], createdAt: sekarang, expireAt: new Date(sekarang.getTime() + STATUS_TTL_MS)
  };
  if (doc.jenis === "gambar") {
    const m = await simpanMedia(gambar, { jenis: "gambar", maks: BATAS.gambarBytes });
    if (!m.ok) return m;
    doc.mediaId = m.id;
    doc.teks = bersihTeks(teks, 200); // keterangan
  } else if (!doc.teks) {
    return { ok: false, alasan: "Tulis sesuatu untuk statusmu." };
  }
  await kol.insertOne(doc);
  return { ok: true, statusId: doc.statusId };
}

const bentuk = (s, me) => ({
  id: s.statusId, jenis: s.jenis, teks: s.teks, latar: s.latar,
  media: s.mediaId ? `/api/wa/media/${s.mediaId}` : null,
  createdAt: s.createdAt, dilihatSaya: (s.dilihat || []).some((v) => v.pid === me.pid),
  jumlahDilihat: s.pid === me.pid ? (s.dilihat || []).length : undefined
});

/** Status semua pengguna (bukan hanya kontak — di sini tiap pengguna adalah "kontak"). */
export async function daftarStatus(me) {
  const kol = await waStatusCol();
  const rows = await kol.find({ expireAt: { $gt: new Date() } }).sort({ createdAt: 1 }).limit(600).toArray();
  const blokir = new Set(me.blokir || []);
  const kelompok = new Map();
  for (const s of rows) {
    if (blokir.has(s.pid)) continue;
    if (!kelompok.has(s.pid)) kelompok.set(s.pid, []);
    kelompok.get(s.pid).push(s);
  }
  const profil = await petaProfil([...kelompok.keys()]);
  const daftar = [...kelompok.entries()].map(([pid, ss]) => ({
    pid, profil: profil[pid] || { pid, nama: "Pengguna" }, saya: pid === me.pid,
    statuses: ss.map((s) => bentuk(s, me)),
    belumDilihat: pid !== me.pid && ss.some((s) => !(s.dilihat || []).some((v) => v.pid === me.pid)),
    terbaru: ss[ss.length - 1].createdAt
  }));
  daftar.sort((a, b) => Number(b.saya) - Number(a.saya) || Number(b.belumDilihat) - Number(a.belumDilihat) || new Date(b.terbaru) - new Date(a.terbaru));
  return daftar;
}

export async function lihatStatus(me, statusId) {
  const kol = await waStatusCol();
  const s = await kol.findOne({ statusId: String(statusId) });
  if (!s || s.expireAt < new Date()) return { ok: false, alasan: "Status sudah berakhir." };
  if (s.pid === me.pid) return { ok: true };
  if ((s.dilihat || []).some((v) => v.pid === me.pid)) return { ok: true };
  await kol.updateOne({ statusId: s.statusId }, { $push: { dilihat: { pid: me.pid, at: new Date() } } });
  return { ok: true };
}

/** Siapa saja yang melihat statusku (hanya pemilik). */
export async function penontonStatus(me, statusId) {
  const s = await (await waStatusCol()).findOne({ statusId: String(statusId), pid: me.pid });
  if (!s) return null;
  const profil = await petaProfil((s.dilihat || []).map((v) => v.pid));
  return (s.dilihat || []).map((v) => ({ ...(profil[v.pid] || { pid: v.pid, nama: "Pengguna" }), at: v.at })).reverse();
}

export async function hapusStatus(me, statusId) {
  const r = await (await waStatusCol()).deleteOne({ statusId: String(statusId), pid: me.pid });
  return { ok: r.deletedCount > 0 };
}

/** Jumlah pemilik status yang belum sepenuhnya dilihat (untuk titik di tab Status). */
export async function jumlahStatusBaru(me) {
  const rows = await (await waStatusCol()).find({ expireAt: { $gt: new Date() }, pid: { $ne: me.pid } }, { projection: { pid: 1, dilihat: 1 } }).limit(600).toArray();
  const blokir = new Set(me.blokir || []);
  const pemilik = new Set();
  for (const s of rows) if (!blokir.has(s.pid) && !(s.dilihat || []).some((v) => v.pid === me.pid)) pemilik.add(s.pid);
  return pemilik.size;
}
