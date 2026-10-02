// Saringan kata terlarang WEARTA CHAT (sisi server): pesan yang memuat kata terlarang DIHAPUS OTOMATIS oleh sistem.
// Daftar & saklar diatur admin (Konfigurasi → WA_KATA_TERLARANG / WA_FILTER_AKTIF). Pencocokan: lib/wa/saringKata.js.
import { waFilterLogCol } from "@/lib/db";
import { cfg } from "@/lib/config";
import { buatPenyaring, teksPesan, KATA_BAWAAN } from "@/lib/wa/saringKata";

let cache = { kunci: null, f: null };
async function penyaring() {
  if (String((await cfg("WA_FILTER_AKTIF")) ?? "1") === "0") return null;
  const mentah = String((await cfg("WA_KATA_TERLARANG")) ?? KATA_BAWAAN.join(","));
  if (cache.kunci !== mentah) cache = { kunci: mentah, f: buatPenyaring(mentah) };
  return cache.f;
}

/** Kata terlarang yang ditemukan di teks (atau null). */
export async function kataTerlarang(teks) {
  const f = await penyaring();
  return f ? f(teks) : null;
}
export async function periksaPesan(msg) {
  const f = await penyaring();
  return f ? f(teksPesan(msg)) : null;
}

/** Mencatat satu penghapusan otomatis (untuk ditinjau admin). Isi pesan TIDAK disimpan utuh — hanya cuplikan pendek tersamar. */
export async function catatSaringan({ me, roomId, kata, teks, aksi = "kirim" }) {
  try {
    const cuplik = String(teks || "").replace(/\s+/g, " ").trim().slice(0, 60);
    await (await waFilterLogCol()).insertOne({ pid: me?.pid || null, nama: me?.nama || "", roomId, kata, cuplikan: cuplik, aksi, at: new Date() });
  } catch (err) { console.error("[wa/saring] log:", err?.message || err); }
}

export async function daftarSaringan({ limit = 50 } = {}) {
  const kol = await waFilterLogCol();
  const [items, total, hariIni] = await Promise.all([
    kol.find({}).sort({ at: -1 }).limit(Math.min(200, limit)).toArray(),
    kol.countDocuments({}),
    kol.countDocuments({ at: { $gte: new Date(Date.now() - 86400_000) } })
  ]);
  const teratas = await kol.aggregate([{ $group: { _id: "$kata", n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 10 }]).toArray();
  return { total, hariIni, teratas: teratas.map((x) => ({ kata: x._id, jumlah: x.n })), items: items.map((x) => ({ pid: x.pid, nama: x.nama, room: x.roomId, kata: x.kata, cuplikan: x.cuplikan, aksi: x.aksi, at: x.at })) };
}
