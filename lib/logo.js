import { settingsCol } from "@/lib/db";

// Logo situs yang bisa diunggah admin. Dua slot:
//   utama = logo lebar (layar pemuatan, gambar pratinjau tautan)
//   ikon  = logo persegi (bilah atas, favicon, ikon aplikasi PWA, notifikasi)
//   sambutan = gambar sambutan bot Telegram (bot-welcome.jpg); tanpa SVG karena Telegram menolaknya
// Kosong = berkas bawaan di public/ (logo Arta Pedia). Bytes disimpan di koleksi
// settings (dokumen terpisah dari konfigurasi utama, supaya tidak ikut ke tiap
// pembacaan settings) dan disajikan lewat /api/logo/<jenis>.
export const JENIS_LOGO = ["utama", "ikon", "sambutan"];
export const MAKS_BYTE = 900_000;

const TIPE = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/svg+xml": "svg" };
const idDoc = (j) => `logo_${j}`;

function sahBytes(tipe, buf) {
  if (tipe === "image/png") return buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  if (tipe === "image/jpeg") return buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8;
  if (tipe === "image/webp") return buf.length > 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP";
  if (tipe === "image/svg+xml") {
    const t = buf.toString("utf8");
    return /<svg[\s>]/i.test(t) && !/<script|<foreignObject|\son\w+\s*=|javascript:|<!ENTITY/i.test(t);
  }
  return false;
}

/** Menyimpan logo dari data URL. Mengembalikan { ok, versi } atau { ok:false, alasan }. */
export async function simpanLogo(jenis, dataUrl) {
  if (!JENIS_LOGO.includes(jenis)) return { ok: false, alasan: "Jenis logo tidak dikenal." };
  const m = /^data:([a-z+\/]+);base64,([A-Za-z0-9+\/=]+)$/.exec(String(dataUrl || ""));
  if (jenis === "sambutan" && m?.[1] === "image/svg+xml") return { ok: false, alasan: "Gambar bot harus PNG, JPG, atau WebP." };
  if (!m || !TIPE[m[1]]) return { ok: false, alasan: "Format harus PNG, JPG, WebP, atau SVG." };
  const buf = Buffer.from(m[2], "base64");
  if (buf.length > MAKS_BYTE) return { ok: false, alasan: "Ukuran logo maksimal sekitar 900 KB." };
  if (!sahBytes(m[1], buf)) return { ok: false, alasan: "Isi berkas tidak cocok dengan formatnya (atau SVG berisi skrip)." };
  const versi = Date.now();
  const col = await settingsCol();
  await col.updateOne({ _id: idDoc(jenis) }, { $set: { data: buf.toString("base64"), tipe: m[1], versi, updatedAt: new Date() } }, { upsert: true });
  return { ok: true, versi, tipe: m[1] };
}

export async function hapusLogo(jenis) {
  if (!JENIS_LOGO.includes(jenis)) return { ok: false, alasan: "Jenis logo tidak dikenal." };
  const col = await settingsCol();
  await col.deleteOne({ _id: idDoc(jenis) });
  return { ok: true };
}

/** Isi logo untuk disajikan, atau null bila memakai bawaan. */
export async function bacaLogo(jenis) {
  if (!JENIS_LOGO.includes(jenis)) return null;
  const d = await (await settingsCol()).findOne({ _id: idDoc(jenis) });
  if (!d?.data) return null;
  return { buf: Buffer.from(d.data, "base64"), tipe: d.tipe, versi: d.versi || 0 };
}

/** Ringkasan { utama: {v,tipe}|null, ikon: {v,tipe}|null } tanpa memuat bytes ke respons. Tidak pernah melempar. */
export async function ringkasLogo() {
  const out = { utama: null, ikon: null, sambutan: null };
  try {
    const col = await settingsCol();
    for (const j of JENIS_LOGO) {
      const d = await col.findOne({ _id: idDoc(j) }, { projection: { tipe: 1, versi: 1, data: 1 } });
      if (d?.data) out[j] = { v: d.versi || 1, tipe: d.tipe };
    }
  } catch {}
  return out;
}
