// Konfigurasi terpusat: nilai dari web (dasbor admin) atau dari Environment
// Variables Vercel, mana pun yang terisi.
//
// Urutan: web → Vercel → (isian lama di pengaturan) → bawaan.
//
// KEAMANAN
//   - Disimpan di koleksi `app_config`, BUKAN `settings`. Backup penuh dan
//     ekspor admin mengekspor `settings`; kunci API yang ikut ke berkas backup
//     berarti ikut ke Telegram dan ke mana pun berkas itu diteruskan.
//   - Rahasia dienkripsi AES-256-GCM. Kuncinya diturunkan dari MONGODB_URI,
//     yang hanya ada di Vercel dan tidak pernah ada di database. Dump database
//     yang bocor tidak membawa kuncinya.
//   - Tidak ada jalur yang mengembalikan rahasia utuh ke peramban; hanya
//     versi yang disamarkan (lihat daftarUntukAdmin).
import crypto from "node:crypto";
import { getDb } from "@/lib/db";
import { KONFIG, PETA, bolehDiweb, samarkan } from "@/lib/configRegistry";

const DOK = "nilai";
// Isian lama di dokumen `settings`. Dibaca supaya yang sudah pernah disimpan
// lewat panel Telegram yang lama tidak mendadak hilang.
const LAMA = {
  TELEGRAM_BOT_TOKEN: "telegramBotToken",
  TELEGRAM_CHAT_ID: "telegramChatId",
  TELEGRAM_CHANNEL_ID: "telegramChannelId"
};

const UMUR_CACHE_MS = 10_000;
let cache = null; // { at, web: {NAMA: nilai}, lama: {...} }
let sedangMuat = null;

async function koleksi() {
  return (await getDb()).collection("app_config");
}

function kunci() {
  return crypto.createHash("sha256").update(`artapedia-konfig:${process.env.MONGODB_URI || ""}`).digest();
}

export function sandi(teks) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", kunci(), iv);
  const isi = Buffer.concat([c.update(String(teks), "utf8"), c.final()]);
  return "enc:v1:" + Buffer.concat([iv, c.getAuthTag(), isi]).toString("base64");
}

/** null kalau tidak terbaca (kunci berganti / data rusak) — bukan melempar. */
export function bukaSandi(nilai) {
  if (typeof nilai !== "string" || !nilai.startsWith("enc:v1:")) return nilai;
  try {
    const b = Buffer.from(nilai.slice(7), "base64");
    const d = crypto.createDecipheriv("aes-256-gcm", kunci(), b.subarray(0, 12));
    d.setAuthTag(b.subarray(12, 28));
    return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}

async function muat() {
  const sekarang = Date.now();
  if (cache && sekarang - cache.at < UMUR_CACHE_MS) return cache;
  // Satu pemuatan untuk semua pemanggil yang datang bersamaan.
  if (sedangMuat) return sedangMuat;
  sedangMuat = (async () => {
    let web = {};
    let lama = {};
    try {
      const col = await koleksi();
      const d = await col.findOne({ _id: DOK });
      const mentah = d?.nilai || {};
      for (const [k, v] of Object.entries(mentah)) {
        const isi = bukaSandi(v);
        if (isi !== null && isi !== "") web[k] = isi;
      }
      const s = await (await getDb()).collection("settings").findOne({ _id: "config" }, {
        projection: Object.fromEntries(Object.values(LAMA).map((f) => [f, 1]))
      });
      for (const [nama, f] of Object.entries(LAMA)) if (s?.[f]) lama[nama] = String(s[f]);
    } catch (err) {
      // Database tidak terjangkau: jatuh ke env saja. Menolak semuanya karena
      // konfigurasi tidak terbaca akan mematikan seluruh situs.
      console.error("[config] gagal membaca dari database, memakai env:", err?.message || err);
      // Ditandai gagal, dan dicoba lagi sebentar lagi (bukan menunggu seluruh
      // umur cache). Penandanya dipakai lapisan keamanan: kode admin bawaan
      // TIDAK boleh mendadak sah hanya karena database sedang tidak terjangkau.
      if (cache) return { ...cache, gagal: true };
      cache = { at: Date.now() - UMUR_CACHE_MS + 2000, web: {}, lama: {}, gagal: true };
      return cache;
    }
    cache = { at: Date.now(), web, lama, gagal: false };
    return cache;
  })().finally(() => {
    sedangMuat = null;
  });
  return sedangMuat;
}

/** true kalau konfigurasi dari database terbaca; false kalau yang dipakai hanya env karena database gagal. */
export async function konfigTerbaca() {
  return !(await muat()).gagal;
}

export function lupakanCache() {
  cache = null;
}

/** Sumber sebuah isian: "web" | "vercel" | "bawaan" | "kosong". */
function pilih(nama, c) {
  const def = PETA[nama];
  const env = (process.env[nama] ?? "").toString().trim();
  if (def?.hanyaEnv) return env ? { nilai: env, sumber: "vercel" } : { nilai: "", sumber: "kosong" };
  if (c.web[nama]) return { nilai: c.web[nama], sumber: "web" };
  if (env) return { nilai: env, sumber: "vercel" };
  // Isian lama di dokumen `settings` dipakai HANYA kalau Vercel kosong. Dokumen
  // itu menyalin nilai env saat pertama dibuat, jadi salinan basinya tidak boleh
  // mengalahkan perubahan yang dilakukan belakangan di Vercel.
  if (c.lama[nama]) return { nilai: c.lama[nama], sumber: "web" };
  if (def?.bawaan) return { nilai: def.bawaan, sumber: "bawaan" };
  return { nilai: "", sumber: "kosong" };
}

/** Nilai sebuah isian (string, "" kalau tidak ada). Web menang atas Vercel. */
export async function cfg(nama) {
  return pilih(nama, await muat()).nilai;
}

export async function cfgAngka(nama, bawaan = 0) {
  const n = Number(await cfg(nama));
  return Number.isFinite(n) ? n : bawaan;
}

/** Daftar ID dipisah koma/spasi/titik koma, sebagai array string. */
export async function cfgDaftar(nama) {
  return (await cfg(nama)).split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean);
}

export async function sumberCfg(nama) {
  return pilih(nama, await muat()).sumber;
}

/**
 * Untuk panel admin. TIDAK PERNAH mengembalikan rahasia utuh — hanya yang
 * disamarkan; nilai biasa (bukan rahasia) dikembalikan apa adanya supaya
 * bisa diedit.
 */
export async function daftarUntukAdmin(ekstra = {}) {
  const c = await muat();
  return KONFIG.map((k) => {
    const p = pilih(k.nama, c);
    const dariWeb = !!c.web[k.nama];
    const adaEnv = !!(process.env[k.nama] ?? "").toString().trim();
    return {
      nama: k.nama,
      sumber: ekstra[k.nama]?.sumber || p.sumber,
      adaWeb: ekstra[k.nama]?.adaWeb ?? dariWeb,
      adaEnv,
      terisi: ekstra[k.nama]?.terisi ?? !!p.nilai,
      tampil: k.rahasia ? (p.nilai && p.sumber !== "bawaan" ? samarkan(p.nilai) : "") : p.nilai
    };
  });
}

export function validasi(nama, nilai) {
  const k = PETA[nama];
  if (!k || !bolehDiweb(nama)) return "Isian ini tidak bisa diubah dari web.";
  const v = String(nilai ?? "").trim();
  if (v.length > 500) return "Terlalu panjang (maksimal 500 karakter).";
  if (/[\r\n]/.test(v)) return "Tidak boleh berisi baris baru.";
  if (v && k.cek && !k.cek.test(v)) return k.pesanCek || "Format tidak sah.";
  if (v && k.maks != null && Number(v) > k.maks) return `Maksimal ${k.maks}.`;
  return null;
}

/** Riwayat perubahan: nama isian dan waktunya. TIDAK PERNAH menyimpan nilainya. */
export async function catatRiwayat(nama, aksi) {
  try {
    const col = await koleksi();
    await col.updateOne(
      { _id: DOK },
      { $push: { riwayat: { $each: [{ nama, aksi, at: new Date() }], $slice: -30 } } },
      { upsert: true }
    );
  } catch {}
}

export async function bacaRiwayat() {
  try {
    const d = await (await koleksi()).findOne({ _id: DOK }, { projection: { riwayat: 1 } });
    return (d?.riwayat || []).slice().reverse();
  } catch {
    return [];
  }
}

export async function simpanCfg(nama, nilai) {
  const salah = validasi(nama, nilai);
  if (salah) return { ok: false, alasan: salah };
  const v = String(nilai ?? "").trim();
  const col = await koleksi();
  if (!v) {
    await col.updateOne({ _id: DOK }, { $unset: { [`nilai.${nama}`]: "" }, $set: { updatedAt: new Date() } }, { upsert: true });
  } else {
    const isi = PETA[nama].rahasia ? sandi(v) : v;
    await col.updateOne({ _id: DOK }, { $set: { [`nilai.${nama}`]: isi, updatedAt: new Date() } }, { upsert: true });
  }
  lupakanCache();
  await catatRiwayat(nama, v ? "diisi" : "dikosongkan");
  return { ok: true };
}

/** Menyimpan/membaca nilai internal (mis. hash kode admin) — tidak lewat daftar registri. */
export async function bacaInternal(kunciInternal) {
  const col = await koleksi();
  const d = await col.findOne({ _id: DOK });
  return d?.internal?.[kunciInternal] ?? "";
}

export async function tulisInternal(kunciInternal, nilai) {
  const col = await koleksi();
  await col.updateOne({ _id: DOK }, { $set: { [`internal.${kunciInternal}`]: nilai, updatedAt: new Date() } }, { upsert: true });
  lupakanCache();
}
