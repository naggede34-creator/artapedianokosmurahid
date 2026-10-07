// Event musiman TERJADWAL OTOMATIS: tanggal kembar (1.1 … 12.12), hari gajian, Ramadan, Idul Fitri, Idul Adha,
// Tahun Baru Islam, Natal, Tahun Baru, 17 Agustus. Tiap event memberi (semuanya bisa diubah/dimatikan admin):
//   • banner + hitung mundur       • diskon harga nokos (SUNGGUHAN — dipotong dari markup, tidak pernah di bawah modal)
//   • bonus cashback deposit       • tema otomatis (warna aksen, gaya, skin maskot) selama event
//
// Kalender Hijriah dihitung dari Intl (Umm al-Qura). Penetapan pemerintah Indonesia bisa selisih ±1 hari, jadi tiap event
// bawaan punya "geser hari" yang bisa diatur admin. Admin juga bisa menambah event kustom (mis. ulang tahun toko).
//
// Semua tanggal memakai WIB (UTC+7) dalam bentuk "YYYY-MM-DD", dibandingkan sebagai teks.
import { getDb } from "@/lib/db";
import { cfg, cfgAngka } from "@/lib/config";

const HARI = 86_400_000;
const WIB = 7 * 3600_000;
const koleksi = async () => (await getDb()).collection("musim_event");

export const tanggalWib = (t = Date.now()) => new Date(t + WIB).toISOString().slice(0, 10);
const keMs = (ymd) => Date.parse(`${ymd}T00:00:00Z`);
const tambahHari = (ymd, n) => new Date(keMs(ymd) + n * HARI).toISOString().slice(0, 10);
const akhirHariWib = (ymd) => keMs(ymd) + HARI - WIB; // ms epoch saat hari itu berakhir (WIB)

// ───────────────────────── KALENDER HIJRIAH ─────────────────────────
let fmtHijri = null;
function hijri(ymd) {
  try {
    fmtHijri ||= new Intl.DateTimeFormat("en-u-ca-islamic-umalqura-nu-latn", { day: "numeric", month: "numeric", year: "numeric", timeZone: "UTC" });
    const p = Object.fromEntries(fmtHijri.formatToParts(new Date(`${ymd}T12:00:00Z`)).map((x) => [x.type, x.value]));
    return { d: Number(p.day), m: Number(p.month), y: Number(p.year) };
  } catch { return null; }
}

// ───────────────────────── KATALOG BAWAAN ─────────────────────────
const BULAN = ["", "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

const memoKatalog = new Map();
/** Semua event bawaan yang menyentuh rentang [dari, sampai] (YYYY-MM-DD). Hasil mentah per rentang tahun di-memo (pemindaian Hijriah mahal). */
export function katalogBawaan(dari, sampai) {
  const th0 = Number(dari.slice(0, 4)) - 1, th1 = Number(sampai.slice(0, 4)) + 1;
  const kunci = `${th0}-${th1}`;
  let semua = memoKatalog.get(kunci);
  if (!semua) { semua = bangunKatalog(th0, th1); memoKatalog.set(kunci, semua); if (memoKatalog.size > 6) memoKatalog.delete(memoKatalog.keys().next().value); }
  return semua.filter((e) => e.selesai >= dari && e.mulai <= sampai).map((e) => ({ ...e }));
}

function bangunKatalog(th0, th1) {
  const hasil = [];
  for (let th = th0; th <= th1; th++) {
    // Tanggal kembar
    for (let m = 1; m <= 12; m++) {
      const t = `${th}-${String(m).padStart(2, "0")}-${String(m).padStart(2, "0")}`;
      hasil.push({ id: `kembar-${m}-${th}`, jenis: "kembar", nama: `${m}.${m} Hari Belanja`, ikon: "🛍️", mulai: t, selesai: t, banner: `${m}.${m} — tanggal kembar! Diskon nokos & cashback deposit khusus hari ini.`, diskonPersen: 4, cashbackBonus: 1, warna: "#EC4899", gaya: "", skin: "pesta", musim: "pesta" });
    }
    // Hari gajian: tanggal 25 sampai tanggal 2 bulan berikutnya
    for (let m = 1; m <= 12; m++) {
      const mulai = `${th}-${String(m).padStart(2, "0")}-25`;
      hasil.push({ id: `gajian-${th}-${m}`, jenis: "gajian", nama: "Pesta Gajian", ikon: "💸", mulai, selesai: tambahHari(mulai, 7), banner: "Waktunya gajian! Bonus cashback deposit lebih besar sampai tanggal 2.", diskonPersen: 0, cashbackBonus: 2, warna: "#16915E", gaya: "", skin: "", musim: "" });
    }
    hasil.push({ id: `natal-${th}`, jenis: "natal", nama: "Natal", ikon: "🎄", mulai: `${th}-12-24`, selesai: `${th}-12-26`, banner: "Selamat Natal! Diskon nokos spesial dari ARTA PEDIA.", diskonPersen: 5, cashbackBonus: 1, warna: "#DC2626", gaya: "", skin: "santa", musim: "natal" });
    hasil.push({ id: `tahunbaru-${th}`, jenis: "tahunbaru", nama: "Tahun Baru", ikon: "🎆", mulai: `${th}-12-31`, selesai: `${th + 1}-01-02`, banner: "Selamat Tahun Baru! Diskon & cashback menyambut tahun baru.", diskonPersen: 5, cashbackBonus: 1, warna: "#7C3AED", gaya: "", skin: "pesta", musim: "pesta" });
    hasil.push({ id: `merdeka-${th}`, jenis: "merdeka", nama: "Dirgahayu RI", ikon: "🇮🇩", mulai: `${th}-08-16`, selesai: `${th}-08-18`, banner: "Dirgahayu Republik Indonesia! Diskon nokos kemerdekaan.", diskonPersen: 7, cashbackBonus: 1, warna: "#DC2626", gaya: "", skin: "merdeka", musim: "merdeka" });
  }
  // Hijriah: pindai harian sepanjang rentang lebar, kelompokkan hari yang berurutan.
  const awal = `${th0}-01-01`, akhir = `${th1}-12-31`;
  const jalan = {};
  const tutup = (k) => { const j = jalan[k]; if (j) { hasil.push(j.def(j.mulai, j.selesai, j.th)); delete jalan[k]; } };
  const aturan = [
    { k: "ramadan", cocok: (h) => h.m === 9, def: (mulai, selesai, th) => ({ id: `ramadan-${th}`, jenis: "ramadan", nama: "Ramadan", ikon: "🌙", mulai, selesai, banner: "Marhaban ya Ramadan! Diskon & cashback sepanjang bulan puasa.", diskonPersen: 5, cashbackBonus: 1, warna: "#0F766E", gaya: "", skin: "ramadan", musim: "ramadan" }) },
    { k: "fitri", cocok: (h) => h.m === 10 && h.d <= 3, def: (mulai, selesai, th) => ({ id: `fitri-${th}`, jenis: "fitri", nama: "Idul Fitri", ikon: "🕌", mulai, selesai, banner: "Selamat Idul Fitri! Mohon maaf lahir & batin — diskon spesial Lebaran.", diskonPersen: 8, cashbackBonus: 2, warna: "#15803D", gaya: "", skin: "ramadan", musim: "ramadan" }) },
    { k: "adha", cocok: (h) => h.m === 12 && h.d >= 9 && h.d <= 11, def: (mulai, selesai, th) => ({ id: `adha-${th}`, jenis: "adha", nama: "Idul Adha", ikon: "🐐", mulai, selesai, banner: "Selamat Idul Adha! Diskon nokos spesial.", diskonPersen: 5, cashbackBonus: 1, warna: "#0D9488", gaya: "", skin: "ramadan", musim: "ramadan" }) },
    { k: "muharram", cocok: (h) => h.m === 1 && h.d === 1, def: (mulai, selesai, th) => ({ id: `muharram-${th}`, jenis: "muharram", nama: "Tahun Baru Islam", ikon: "🌟", mulai, selesai, banner: "Selamat Tahun Baru Islam 1 Muharram!", diskonPersen: 3, cashbackBonus: 1, warna: "#0F766E", gaya: "", skin: "ramadan", musim: "ramadan" }) }
  ];
  for (let t = awal; t <= akhir; t = tambahHari(t, 1)) {
    const h = hijri(t);
    if (!h) break;
    for (const a of aturan) {
      const j = jalan[a.k];
      if (a.cocok(h)) { if (!j) jalan[a.k] = { mulai: t, selesai: t, th: t.slice(0, 4), def: a.def }; else j.selesai = t; }
      else if (j) tutup(a.k);
    }
  }
  for (const a of aturan) tutup(a.k);
  return hasil.sort((a, b) => (a.mulai < b.mulai ? -1 : a.mulai > b.mulai ? 1 : 0));
}

// ───────────────────────── PENGATURAN ADMIN ─────────────────────────
/** Ubahan admin untuk event bawaan + event kustom. */
async function bacaAdmin() {
  try { return await (await koleksi()).find({}).limit(500).toArray(); } catch { return []; }
}

const bersih = (e) => ({
  id: e.id, jenis: e.jenis || "kustom", nama: e.nama, ikon: e.ikon || "🎉", mulai: e.mulai, selesai: e.selesai, banner: e.banner || "",
  diskonPersen: Number(e.diskonPersen) || 0, cashbackBonus: Number(e.cashbackBonus) || 0, warna: e.warna || "", gaya: e.gaya || "", skin: e.skin || "", musim: e.musim || "",
  bawaan: !!e.bawaan, aktif: e.aktif !== false
});

/** Gabungan: bawaan (dengan ubahan admin) + kustom, dalam rentang tanggal. */
export async function daftarEvent(dari, sampai) {
  const admin = await bacaAdmin();
  const ubah = Object.fromEntries(admin.filter((a) => a.kind === "ubah").map((a) => [a.target, a]));
  const hasil = [];
  for (const e of katalogBawaan(dari, sampai)) {
    const u = ubah[e.id] || {};
    const geser = Number(u.geserHari) || 0;
    const m = geser ? { ...e, mulai: tambahHari(e.mulai, geser), selesai: tambahHari(e.selesai, geser) } : e;
    hasil.push(bersih({ ...m, bawaan: true, aktif: u.aktif, ...(u.diskonPersen !== undefined && u.diskonPersen !== "" ? { diskonPersen: u.diskonPersen } : {}), ...(u.cashbackBonus !== undefined && u.cashbackBonus !== "" ? { cashbackBonus: u.cashbackBonus } : {}), ...(u.banner ? { banner: u.banner } : {}), ...(u.warna !== undefined ? { warna: u.warna ?? m.warna } : {}), ...(u.skin !== undefined ? { skin: u.skin } : {}), ...(u.gaya !== undefined ? { gaya: u.gaya } : {}) }));
    const e2 = hasil[hasil.length - 1]; e2.geserHari = geser;
  }
  for (const k of admin.filter((a) => a.kind === "kustom")) {
    if (k.selesai >= dari && k.mulai <= sampai) hasil.push(bersih({ ...k, id: k.id || String(k._id), jenis: "kustom", bawaan: false }));
  }
  return hasil.sort((a, b) => (a.mulai < b.mulai ? -1 : a.mulai > b.mulai ? 1 : 0));
}

// ───────────────────────── STATUS SEKARANG (di-cache) ─────────────────────────
let cache = { t: 0, v: null };
const UMUR_CACHE = 45_000;

async function hitung() {
  const aktifGlobal = String((await cfg("MUSIM_AKTIF")) ?? "1") !== "0";
  const hariIni = tanggalWib();
  const kosong = { aktif: false, utama: null, semua: [], diskonPersen: 0, cashbackBonus: 0, berikutnya: [] };
  if (!aktifGlobal) return kosong;
  const maks = Math.max(0, await cfgAngka("MUSIM_DISKON_MAKS", 10));
  const dalam = (await daftarEvent(hariIni, tambahHari(hariIni, 90))).filter((e) => e.aktif);
  const berjalan = dalam.filter((e) => e.mulai <= hariIni && e.selesai >= hariIni);
  // Utama: yang paling "bernilai" (diskon + cashback), lalu yang paling cepat berakhir.
  const urut = [...berjalan].sort((a, b) => b.diskonPersen + b.cashbackBonus - (a.diskonPersen + a.cashbackBonus) || (a.selesai < b.selesai ? -1 : 1));
  const utama = urut[0] || null;
  const tampil = (e) => ({ ...e, sampai: akhirHariWib(e.selesai), sisaMs: Math.max(0, akhirHariWib(e.selesai) - Date.now()) });
  return {
    aktif: berjalan.length > 0,
    utama: utama ? tampil(utama) : null,
    semua: berjalan.map((e) => e.id),
    skinMusim: [...new Set(berjalan.map((e) => e.musim).filter(Boolean))],
    // Tidak ditumpuk: yang tertinggi saja, dibatasi MUSIM_DISKON_MAKS.
    diskonPersen: Math.min(maks, Math.max(0, ...berjalan.map((e) => e.diskonPersen), 0)),
    cashbackBonus: Math.min(10, Math.max(0, ...berjalan.map((e) => e.cashbackBonus), 0)),
    berikutnya: dalam.filter((e) => e.mulai > hariIni).slice(0, 4).map((e) => ({ id: e.id, nama: e.nama, ikon: e.ikon, mulai: e.mulai, selesai: e.selesai, dalamHari: Math.round((keMs(e.mulai) - keMs(hariIni)) / HARI), diskonPersen: e.diskonPersen, cashbackBonus: e.cashbackBonus }))
  };
}

export async function musimSekarang({ segar = false } = {}) {
  if (!segar && cache.v && Date.now() - cache.t < UMUR_CACHE) return cache.v;
  try { cache = { t: Date.now(), v: await hitung() }; } catch (e) { console.error("[musim]", e?.message || e); cache = { t: Date.now(), v: cache.v || { aktif: false, utama: null, semua: [], diskonPersen: 0, cashbackBonus: 0, berikutnya: [] } }; }
  return cache.v;
}
export const lupakanCacheMusim = () => { cache = { t: 0, v: null }; };

/** Dipakai getSettings(): angka yang ikut menurunkan harga & menaikkan cashback. Tidak pernah melempar. */
export async function efekMusim() {
  const m = await musimSekarang();
  return { eventDiskonPersen: m.diskonPersen || 0, eventCashbackBonus: m.cashbackBonus || 0, eventNama: m.utama?.nama || "" };
}

// ───────────────────────── ADMIN: SIMPAN ─────────────────────────
const pecahDesimal = (v, maks) => Math.min(maks, Math.max(0, Number(v) || 0));
const hexAman = (v) => (/^#[0-9a-f]{6}$/i.test(String(v || "")) ? String(v).toUpperCase() : "");

export async function ubahEventBawaan(id, o) {
  const set = { kind: "ubah", target: String(id), updatedAt: new Date() };
  if (o.aktif !== undefined) set.aktif = !!o.aktif;
  if (o.diskonPersen !== undefined) set.diskonPersen = pecahDesimal(o.diskonPersen, 50);
  if (o.cashbackBonus !== undefined) set.cashbackBonus = pecahDesimal(o.cashbackBonus, 20);
  if (o.banner !== undefined) set.banner = String(o.banner).slice(0, 160);
  if (o.geserHari !== undefined) set.geserHari = Math.max(-3, Math.min(3, Math.round(Number(o.geserHari) || 0)));
  if (o.warna !== undefined) set.warna = hexAman(o.warna);
  await (await koleksi()).updateOne({ _id: `ubah:${id}` }, { $set: set }, { upsert: true });
  lupakanCacheMusim();
}

export async function simpanEventKustom(o) {
  const ymd = /^\d{4}-\d{2}-\d{2}$/;
  if (!ymd.test(o.mulai || "") || !ymd.test(o.selesai || "") || o.selesai < o.mulai) return { ok: false, alasan: "Tanggal mulai/selesai tidak valid (YYYY-MM-DD)." };
  const nama = String(o.nama || "").trim().slice(0, 60);
  if (nama.length < 3) return { ok: false, alasan: "Nama event minimal 3 huruf." };
  const id = o.id && /^k_[a-z0-9]+$/.test(o.id) ? o.id : `k_${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
  const doc = { kind: "kustom", id, nama, ikon: String(o.ikon || "🎉").slice(0, 4), mulai: o.mulai, selesai: o.selesai, banner: String(o.banner || "").slice(0, 160), diskonPersen: pecahDesimal(o.diskonPersen, 50), cashbackBonus: pecahDesimal(o.cashbackBonus, 20), warna: hexAman(o.warna), gaya: String(o.gaya || "").slice(0, 12), skin: String(o.skin || "").slice(0, 12), musim: String(o.musim || "").slice(0, 12), aktif: o.aktif !== false, updatedAt: new Date() };
  await (await koleksi()).updateOne({ _id: id }, { $set: doc }, { upsert: true });
  lupakanCacheMusim();
  return { ok: true, id };
}

export async function hapusEventKustom(id) {
  await (await koleksi()).deleteOne({ _id: String(id), kind: "kustom" });
  lupakanCacheMusim();
}
