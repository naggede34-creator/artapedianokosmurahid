// Popup buatan admin yang muncul di layar pengguna: judul, teks, foto unggahan, dan tombol ke dasbor/halaman tertentu.
// Frekuensi: "sekali" (sekali per versi popup), "sesi" (sekali tiap membuka web), "hari" (sekali sehari).
import { randomUUID } from "node:crypto";
import { popupAdminCol } from "@/lib/db";
import { tautanAman } from "@/lib/tautanDasbor";

const FREK = ["sekali", "sesi", "hari"];
const MAKS_GAMBAR = 1_400_000;

export function gambarAman(v) {
  const s = String(v || "").trim();
  if (!s) return "";
  if (/^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(s)) return s.length <= MAKS_GAMBAR ? s : "";
  if (/^https:\/\/[^\s<>"']+$/i.test(s)) return s.slice(0, 500);
  return "";
}
const tanggal = (v) => { if (!v) return null; const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d; };

const keAdmin = (d) => ({ id: d.pid, judul: d.judul, teks: d.teks, gambar: d.gambar || "", tombolTeks: d.tombolTeks || "", tombolHref: d.tombolHref || "", aktif: !!d.aktif, frekuensi: d.frekuensi, urutan: d.urutan || 0, mulai: d.mulai || null, selesai: d.selesai || null, versi: d.versi, dibuat: d.createdAt });

export async function daftarAdmin() {
  return (await (await popupAdminCol()).find({}).sort({ urutan: 1, createdAt: -1 }).toArray()).map(keAdmin);
}

/** Popup yang sedang berlaku (aktif & dalam jadwal) untuk pengguna. */
export async function popupPublik() {
  const now = new Date();
  const semua = await (await popupAdminCol()).find({ aktif: true }).sort({ urutan: 1, createdAt: -1 }).limit(20).toArray();
  return semua
    .filter((d) => (!d.mulai || new Date(d.mulai) <= now) && (!d.selesai || new Date(d.selesai) >= now))
    .map((d) => ({ id: d.pid, versi: d.versi, judul: d.judul, teks: d.teks, gambar: d.gambar || "", tombolTeks: d.tombolTeks || "", tombolHref: d.tombolHref || "", frekuensi: d.frekuensi }));
}

function rapikan(b, { baru }) {
  const out = {};
  if (baru || b.judul !== undefined) out.judul = String(b.judul || "").replace(/\s+/g, " ").trim().slice(0, 120);
  if (baru || b.teks !== undefined) out.teks = String(b.teks || "").trim().slice(0, 1500);
  if (baru || b.gambar !== undefined) out.gambar = gambarAman(b.gambar);
  if (baru || b.tombolTeks !== undefined) out.tombolTeks = String(b.tombolTeks || "").trim().slice(0, 40);
  if (baru || b.tombolHref !== undefined) out.tombolHref = tautanAman(b.tombolHref);
  if (baru || b.frekuensi !== undefined) out.frekuensi = FREK.includes(b.frekuensi) ? b.frekuensi : "sekali";
  if (baru || b.urutan !== undefined) out.urutan = Math.max(0, Math.min(999, Math.floor(Number(b.urutan) || 0)));
  if (baru || b.mulai !== undefined) out.mulai = tanggal(b.mulai);
  if (baru || b.selesai !== undefined) out.selesai = tanggal(b.selesai);
  return out;
}

export async function simpanPopup(b) {
  const kol = await popupAdminCol();
  const baru = !b.id;
  const f = rapikan(b, { baru });
  if (baru && !f.judul && !f.teks && !f.gambar) return { ok: false, alasan: "Isi minimal judul, teks, atau foto." };
  if (b.tombolHref && !f.tombolHref && (baru || b.tombolHref !== undefined)) return { ok: false, alasan: "Tujuan tombol harus jalur dalam situs (mis. /dashboard) atau alamat https." };
  if (b.gambar && !f.gambar) return { ok: false, alasan: "Foto tidak valid atau terlalu besar (maks ±1 MB; format PNG/JPG/WEBP/GIF)." };
  const now = new Date();
  if (baru) {
    if (f.tombolTeks && !f.tombolHref) return { ok: false, alasan: "Pilih tujuan tombol." };
    const pid = "P" + randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase();
    await kol.insertOne({ pid, ...f, aktif: b.aktif !== false, versi: now.getTime(), createdAt: now, updatedAt: now });
    return { ok: true, id: pid };
  }
  const lama = await kol.findOne({ pid: String(b.id) });
  if (!lama) return { ok: false, alasan: "Popup tidak ditemukan." };
  const gabung = { ...lama, ...f };
  if (gabung.tombolTeks && !gabung.tombolHref) return { ok: false, alasan: "Pilih tujuan tombol." };
  await kol.updateOne({ pid: lama.pid }, { $set: { ...f, ...(b.aktif !== undefined ? { aktif: !!b.aktif } : {}), versi: now.getTime(), updatedAt: now } });
  return { ok: true, id: lama.pid };
}

export async function hapusPopup(id) {
  const r = await (await popupAdminCol()).deleteOne({ pid: String(id) });
  return r.deletedCount ? { ok: true } : { ok: false, alasan: "Popup tidak ditemukan." };
}
export async function nyalakanPopup(id, aktif) {
  const kol = await popupAdminCol();
  const d = await kol.findOne({ pid: String(id) });
  if (!d) return { ok: false, alasan: "Popup tidak ditemukan." };
  const nilai = aktif === undefined ? !d.aktif : !!aktif;
  await kol.updateOne({ pid: d.pid }, { $set: { aktif: nilai, versi: Date.now(), updatedAt: new Date() } });
  return { ok: true, aktif: nilai };
}
