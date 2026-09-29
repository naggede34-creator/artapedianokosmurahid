// Inti Room Chat ala WhatsApp: identitas, profil, lencana, media.
//
// Prinsip yang menjaga semuanya tetap aman:
//   • KODE AKUN (token) tidak pernah keluar dari server. Yang dipakai antar
//     pengguna adalah `pid` — id publik acak. Di web ini token adalah kunci
//     akun; kalau ikut terkirim di daftar kontak/pesan, satu permintaan saja
//     bisa memanen kunci semua orang.
//   • Foto & media tidak ikut di JSON daftar: disajikan lewat URL berversi yang
//     bisa di-cache, supaya polling tiap beberapa detik tetap ringan.
import { randomBytes, randomUUID } from "node:crypto";
import { usersCol, waProfilCol, waMediaCol } from "@/lib/db";

// ─────────────────────────── LENCANA ───────────────────────────
// Diberikan HANYA oleh admin (dasbor → Lencana). Warnanya dipilih admin.
import { LENCANA, lencanaSah } from "@/lib/wa/lencanaWarna";
export { LENCANA, lencanaSah };

// ─────────────────────────── BATAS ───────────────────────────
export const BATAS = {
  namaMin: 2,
  namaMaks: 24,
  bioMaks: 140,
  grupNamaMaks: 40,
  grupDeskripsiMaks: 300,
  grupAnggotaMaks: 256,
  pesanMaks: 2000,
  fotoBytes: 220_000,
  gambarBytes: 900_000,
  suaraBytes: 1_200_000,
  online_ms: 45_000
};

// ─────────────────────────── UTIL ───────────────────────────
export function pidBaru() {
  return "u" + randomBytes(6).toString("base64url").replace(/[-_]/g, "x").toLowerCase().slice(0, 9);
}

export const bersihTeks = (t, maks) =>
  String(t ?? "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .trim()
    .slice(0, maks);

export const escRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function idPrivate(a, b) {
  return "p_" + [a, b].sort().join("_");
}

// ─────────────────────────── AUTENTIKASI ───────────────────────────
const cacheToken = new Map(); // token -> { p, sampai }
const TTL_CACHE_MS = 15_000;

/**
 * Profil milik kode akun, dibuat otomatis bila belum ada. null kalau akunnya
 * tidak ada. Bentuk yang dikembalikan TIDAK memuat foto (lihat fotoV).
 */
export async function masuk(token) {
  const t = String(token || "").trim();
  if (!t || t.length > 64) return null;
  const hit = cacheToken.get(t);
  if (hit && hit.sampai > Date.now()) return hit.p;

  const kol = await waProfilCol();
  const proj = { projection: { foto: 0 } };
  let p = await kol.findOne({ token: t }, proj);
  if (!p) {
    const user = await (await usersCol()).findOne({ token: t }, { projection: { name: 1, suspended: 1, createdAt: 1 } });
    if (!user) return null;
    const dok = {
      pid: pidBaru(),
      token: t,
      nama: bersihTeks(user.name, BATAS.namaMaks) || "Pengguna",
      bio: "Hei, aku pakai Artapedia!",
      fotoV: 0,
      lencana: null,
      blokir: [],
      lastSeen: new Date(),
      createdAt: new Date()
    };
    try {
      await kol.insertOne(dok);
    } catch (err) {
      // Dua permintaan pertama bersamaan: yang kalah membaca punya pemenang.
      if (err?.code !== 11000) throw err;
    }
    p = await kol.findOne({ token: t }, proj);
    if (!p) return null;
  }
  cacheToken.set(t, { p, sampai: Date.now() + TTL_CACHE_MS });
  return p;
}

export function lupakanCache(token) {
  if (token) cacheToken.delete(token);
  else cacheToken.clear();
}

export async function profilPid(pid) {
  if (!pid) return null;
  return (await waProfilCol()).findOne({ pid: String(pid) }, { projection: { foto: 0 } });
}

/** Bentuk publik satu profil: tanpa token, tanpa foto mentah. */
export function publik(p, sekarang = Date.now()) {
  if (!p) return null;
  const terakhir = p.lastSeen ? new Date(p.lastSeen).getTime() : 0;
  return {
    pid: p.pid,
    nama: p.nama,
    bio: p.bio || "",
    fotoV: p.fotoV || 0,
    lencana: p.lencana && lencanaSah(p.lencana) ? p.lencana : null,
    online: sekarang - terakhir < BATAS.online_ms,
    lastSeen: p.sembunyiTerakhir ? null : p.lastSeen || null
  };
}

/** Peta pid → profil publik untuk banyak pid sekaligus. */
export async function petaProfil(pids) {
  const unik = [...new Set((pids || []).filter(Boolean))];
  if (!unik.length) return {};
  const rows = await (await waProfilCol()).find({ pid: { $in: unik } }, { projection: { foto: 0 } }).toArray();
  const sekarang = Date.now();
  return Object.fromEntries(rows.map((p) => [p.pid, publik(p, sekarang)]));
}

// ─────────────────────────── PROFIL ───────────────────────────
export async function ubahProfil(me, { nama, bio, foto, hapusFoto, sembunyiTerakhir }) {
  const kol = await waProfilCol();
  const set = {};
  if (nama !== undefined) {
    const n = String(nama).replace(/\s+/g, " ").trim();
    if (n.length < BATAS.namaMin || n.length > BATAS.namaMaks) return { ok: false, alasan: `Nama ${BATAS.namaMin}–${BATAS.namaMaks} karakter.` };
    if (/https?:\/\/|www\.|<|>/i.test(n)) return { ok: false, alasan: "Nama tidak boleh berisi tautan." };
    set.nama = n;
  }
  if (bio !== undefined) set.bio = bersihTeks(bio, BATAS.bioMaks);
  if (sembunyiTerakhir !== undefined) set.sembunyiTerakhir = !!sembunyiTerakhir;
  if (foto) {
    const r = await simpanMedia(foto, { id: `foto:${me.pid}`, jenis: "gambar", maks: BATAS.fotoBytes });
    if (!r.ok) return r;
    set.fotoV = Date.now();
  } else if (hapusFoto) {
    await (await waMediaCol()).deleteOne({ _id: `foto:${me.pid}` });
    set.fotoV = 0;
  }
  if (!Object.keys(set).length) return { ok: true };
  await kol.updateOne({ pid: me.pid }, { $set: set });
  // Nama juga dipakai bagian lain situs (leaderboard, notifikasi): tetap satu sumber.
  if (set.nama) await (await usersCol()).updateOne({ token: me.token }, { $set: { name: set.nama } });
  lupakanCache(me.token);
  return { ok: true };
}

export async function blokir(me, pidTarget, nyalakan) {
  if (!pidTarget || pidTarget === me.pid) return { ok: false, alasan: "Tidak bisa memblokir diri sendiri." };
  const target = await profilPid(pidTarget);
  if (!target) return { ok: false, alasan: "Pengguna tidak ditemukan." };
  await (await waProfilCol()).updateOne(
    { pid: me.pid },
    nyalakan ? { $addToSet: { blokir: pidTarget } } : { $pull: { blokir: pidTarget } }
  );
  lupakanCache(me.token);
  return { ok: true };
}

/** Salah satu memblokir yang lain? */
export async function terblokir(a, pidB) {
  const pa = a.blokir ? a : await profilPid(a.pid || a);
  if ((pa?.blokir || []).includes(pidB)) return true;
  const pb = await (await waProfilCol()).findOne({ pid: pidB }, { projection: { blokir: 1 } });
  return (pb?.blokir || []).includes(pa?.pid);
}

/** lastSeen dijaga agar tidak menulis ke database tiap polling. */
const catatTerakhir = new Map();
export async function denyut(me) {
  const skrg = Date.now();
  if ((catatTerakhir.get(me.pid) || 0) > skrg - 15_000) return;
  catatTerakhir.set(me.pid, skrg);
  await (await waProfilCol()).updateOne({ pid: me.pid }, { $set: { lastSeen: new Date() } });
}

// ─────────────────────────── MEDIA ───────────────────────────
const MIME_GAMBAR = /^data:(image\/(?:png|jpe?g|webp|gif));base64,([A-Za-z0-9+/=]+)$/;
const MIME_SUARA = /^data:(audio\/(?:webm|ogg|mp4|mpeg|wav|x-m4a|aac))(?:;codecs=[\w.,-]+)?;base64,([A-Za-z0-9+/=]+)$/;

/**
 * Menyimpan data URL sebagai berkas. SVG ditolak (bisa membawa skrip).
 * @returns {{ok:true,id:string,mime:string,bytes:number}|{ok:false,alasan:string}}
 */
export async function simpanMedia(dataUrl, { id = null, jenis = "gambar", maks = BATAS.gambarBytes } = {}) {
  const s = String(dataUrl || "");
  if (s.length > maks * 1.4 + 200) return { ok: false, alasan: "Berkas terlalu besar." };
  const m = (jenis === "suara" ? MIME_SUARA : MIME_GAMBAR).exec(s);
  if (!m) return { ok: false, alasan: jenis === "suara" ? "Format suara tidak didukung." : "Format gambar tidak didukung (PNG/JPG/WEBP/GIF)." };
  const buf = Buffer.from(m[2], "base64");
  if (!buf.length || buf.length > maks) return { ok: false, alasan: "Berkas terlalu besar." };
  const mediaId = id || randomUUID().replace(/-/g, "");
  await (await waMediaCol()).replaceOne(
    { _id: mediaId },
    { _id: mediaId, mime: m[1], data: buf, bytes: buf.length, createdAt: new Date() },
    { upsert: true }
  );
  return { ok: true, id: mediaId, mime: m[1], bytes: buf.length };
}

export async function ambilMedia(id) {
  if (!/^[\w:.-]{3,80}$/.test(String(id || ""))) return null;
  const d = await (await waMediaCol()).findOne({ _id: String(id) });
  if (!d?.data) return null;
  const b = d.data;
  // Binary BSON (driver asli) menyimpan isinya di buffer sepanjang `position`;
  // Uint8Array/Buffer biasa dipakai apa adanya (hanya sepanjang tampilannya).
  const data =
    b?._bsontype === "Binary"
      ? Buffer.from(b.buffer.subarray(0, b.position))
      : Buffer.from(b.buffer, b.byteOffset || 0, b.byteLength ?? b.length);
  return { mime: d.mime, data };
}
