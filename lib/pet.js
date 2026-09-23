// Pet Arta Pedia — elang peliharaan yang tumbuh tiap hari.
//
// Aturan mainnya sengaja dibuat sederhana dan JUJUR: pet naik level dari
// perawatan harian, dan levelnya menambah persen cashback deposit. Karena
// bonus itu uang sungguhan, ada dua batas yang tidak boleh dilanggar dari mana
// pun — bonus per level dan bonus maksimum — dan keduanya dihitung di sini,
// bukan di halaman yang menampilkannya.
import { petsCol } from "@/lib/db";

// XP yang dibutuhkan untuk naik ke level berikutnya. Indeks = level - 1.
// Naiknya melandai: cepat di awal supaya terasa hidup, lalu melambat supaya
// level tinggi tetap berarti sesuatu.
const XP_PER_LEVEL = 100;
export const LEVEL_MAKS = 30;

// Tahap pertumbuhan. Ditentukan LEVEL, bukan umur: kalau ditentukan umur saja,
// orang yang tidak pernah merawatnya tetap punya elang dewasa, dan merawatnya
// jadi tidak ada gunanya.
export const TAHAP = [
  { key: "telur", nama: "Telur", minLevel: 0, emoji: "🥚", skala: 0.55, sub: "Sebentar lagi menetas…" },
  { key: "bayi", nama: "Bayi Elang", minLevel: 2, emoji: "🐣", skala: 0.68, sub: "Masih belajar mengepak." },
  { key: "remaja", nama: "Elang Remaja", minLevel: 8, emoji: "🦅", skala: 0.82, sub: "Sudah berani terbang jauh." },
  { key: "dewasa", nama: "Elang Dewasa", minLevel: 16, emoji: "🦅", skala: 0.95, sub: "Tangguh dan tenang." },
  { key: "juara", nama: "Elang Juara", minLevel: 25, emoji: "👑", skala: 1.1, sub: "Penjaga Arta Pedia." }
];

export function tahapUntuk(level) {
  let hasil = TAHAP[0];
  for (const t of TAHAP) if (level >= t.minLevel) hasil = t;
  return hasil;
}

export const levelDariXp = (xp) => Math.min(LEVEL_MAKS, Math.floor((Number(xp) || 0) / XP_PER_LEVEL));
export const xpUntukLevel = (level) => Math.min(LEVEL_MAKS, level) * XP_PER_LEVEL;

// Tanggal WIB, dipakai untuk membatasi perawatan sekali sehari. Memakai tanggal
// server (UTC) akan membuat "hari baru" jatuh jam 7 pagi WIB, dan orang yang
// merawat petnya tiap malam akan merasa jatahnya hilang.
export function hariIniWIB(now = new Date()) {
  return new Date(now).toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });
}

// Nilai bawaan; admin bisa mengubahnya lewat pengaturan.
export const PET_DEFAULTS = {
  enabled: true,
  // Tambahan persen cashback per level pet.
  bonusPerLevel: 0.1,
  // Batas atas tambahan itu. Ada supaya kesalahan mengisi bonusPerLevel tidak
  // langsung berubah jadi cashback puluhan persen.
  maxBonus: 2,
  xpBeriMakan: 15,
  xpBermain: 10,
  // XP yang didapat hanya karena harinya berganti — pet tetap tumbuh walau
  // pemiliknya sedang sibuk, cuma jauh lebih lambat daripada yang dirawat.
  xpHarian: 5
};

export function petConfig(settings) {
  const p = settings?.pet || {};
  const n = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
  return {
    enabled: p.enabled !== false,
    bonusPerLevel: Math.max(0, Math.min(1, n(p.bonusPerLevel, PET_DEFAULTS.bonusPerLevel))),
    maxBonus: Math.max(0, Math.min(10, n(p.maxBonus, PET_DEFAULTS.maxBonus))),
    xpBeriMakan: Math.max(0, Math.min(100, n(p.xpBeriMakan, PET_DEFAULTS.xpBeriMakan))),
    xpBermain: Math.max(0, Math.min(100, n(p.xpBermain, PET_DEFAULTS.xpBermain))),
    xpHarian: Math.max(0, Math.min(100, n(p.xpHarian, PET_DEFAULTS.xpHarian)))
  };
}

/**
 * Tambahan persen cashback dari pet. SELALU lewat fungsi ini, jangan dihitung
 * ulang di tempat lain — batas maksimumnya ada di sini, dan bonus yang
 * dihitung di dua tempat cepat atau lambat akan berbeda di salah satunya.
 */
export function petCashbackBonus(pet, settings) {
  const cfg = petConfig(settings);
  if (!cfg.enabled || !pet) return 0;
  const level = Math.max(0, Math.min(LEVEL_MAKS, Number(pet.level) || 0));
  return Math.min(cfg.maxBonus, Number((level * cfg.bonusPerLevel).toFixed(2)));
}

/**
 * Ambil pet milik satu akun; buat kalau belum ada.
 *
 * Sekalian memberikan XP harian untuk hari-hari yang terlewat, dibatasi tujuh
 * hari. Tanpa batas itu, akun yang ditinggal sebulan tiba-tiba melonjak
 * beberapa level sekaligus saat dibuka — yang terbaca sebagai hadiah untuk
 * tidak merawat.
 */
export async function ambilPet(token, settings, now = new Date()) {
  if (!token) return null;
  const cfg = petConfig(settings);
  const col = await petsCol();
  const hariIni = hariIniWIB(now);

  let pet = await col.findOne({ token });
  if (!pet) {
    pet = {
      token,
      nama: "Elangku",
      xp: 0,
      level: 0,
      bornAt: now,
      terakhirMakan: null,
      terakhirMain: null,
      hariTerakhirDihitung: hariIni,
      totalHariDirawat: 0,
      createdAt: now
    };
    await col.insertOne(pet);
    return bentukPet(pet, settings, hariIni);
  }

  if (pet.hariTerakhirDihitung !== hariIni && cfg.xpHarian > 0) {
    const selisihHari = Math.min(
      7,
      Math.max(1, Math.round((new Date(hariIni) - new Date(pet.hariTerakhirDihitung || hariIni)) / 86400000))
    );
    const tambah = selisihHari * cfg.xpHarian;
    const xpBaru = Math.min(xpUntukLevel(LEVEL_MAKS), (pet.xp || 0) + tambah);
    await col.updateOne(
      { token },
      { $set: { xp: xpBaru, level: levelDariXp(xpBaru), hariTerakhirDihitung: hariIni } }
    );
    pet = { ...pet, xp: xpBaru, level: levelDariXp(xpBaru), hariTerakhirDihitung: hariIni };
  }

  return bentukPet(pet, settings, hariIni);
}

function bentukPet(pet, settings, hariIni) {
  const level = levelDariXp(pet.xp);
  const tahap = tahapUntuk(level);
  const xpDiLevel = (pet.xp || 0) - xpUntukLevel(level);
  const umurHari = Math.max(0, Math.floor((Date.now() - new Date(pet.bornAt || pet.createdAt || Date.now())) / 86400000));

  return {
    nama: pet.nama || "Elangku",
    xp: pet.xp || 0,
    level,
    levelMaks: LEVEL_MAKS,
    xpDiLevel,
    xpButuh: XP_PER_LEVEL,
    persenKeLevelBerikut: level >= LEVEL_MAKS ? 100 : Math.round((xpDiLevel / XP_PER_LEVEL) * 100),
    tahap: tahap.key,
    tahapNama: tahap.nama,
    tahapSub: tahap.sub,
    emoji: tahap.emoji,
    skala: tahap.skala,
    umurHari,
    totalHariDirawat: pet.totalHariDirawat || 0,
    sudahMakanHariIni: pet.terakhirMakan === hariIni,
    sudahMainHariIni: pet.terakhirMain === hariIni,
    bonusCashback: petCashbackBonus({ level }, settings)
  };
}

/**
 * Satu perawatan: "makan" atau "main". Masing-masing sekali per hari.
 *
 * Batas hariannya ada DI DALAM filter update, bukan diperiksa lebih dulu lalu
 * di-update. Dua ketukan cepat kalau begitu memberi XP dua kali — dan XP di
 * sini berujung pada persen cashback, jadi ia bagian dari jalur uang.
 */
export async function rawatPet(token, jenis, settings, now = new Date()) {
  if (!token) return { ok: false, error: "Kode akun tidak valid." };
  const cfg = petConfig(settings);
  if (!cfg.enabled) return { ok: false, error: "Fitur pet sedang dimatikan admin." };

  const field = jenis === "makan" ? "terakhirMakan" : jenis === "main" ? "terakhirMain" : null;
  if (!field) return { ok: false, error: "Jenis perawatan tidak dikenal." };

  const tambah = jenis === "makan" ? cfg.xpBeriMakan : cfg.xpBermain;
  const hariIni = hariIniWIB(now);
  const col = await petsCol();

  const sebelum = await col.findOne({ token });
  if (!sebelum) {
    await ambilPet(token, settings, now);
  }

  const klaim = await col.findOneAndUpdate(
    { token, [field]: { $ne: hariIni } },
    {
      $set: { [field]: hariIni, hariTerakhirDihitung: hariIni },
      $inc: { xp: tambah }
    },
    { returnDocument: "after" }
  );
  if (!klaim) {
    return { ok: false, error: jenis === "makan" ? "Petmu sudah makan hari ini." : "Petmu sudah bermain hari ini." };
  }

  // XP tidak boleh melewati batas level tertinggi.
  const batas = xpUntukLevel(LEVEL_MAKS);
  const xpFinal = Math.min(batas, klaim.xp || 0);
  const levelBaru = levelDariXp(xpFinal);
  const naik = levelBaru > (sebelum ? levelDariXp(sebelum.xp) : 0);

  await col.updateOne(
    { token },
    {
      $set: { xp: xpFinal, level: levelBaru },
      // Hari dihitung "dirawat" SEKALI saja, walau makan dan main dua-duanya
      // dilakukan di hari yang sama. Yang diperiksa keadaan SEBELUM perawatan
      // ini: kalau salah satunya sudah dilakukan hari ini, harinya sudah
      // terhitung dan tidak boleh dihitung lagi.
      ...(sebelum && (sebelum.terakhirMakan === hariIni || sebelum.terakhirMain === hariIni)
        ? {}
        : { $inc: { totalHariDirawat: 1 } })
    }
  );

  const pet = await ambilPet(token, settings, now);
  return { ok: true, naikLevel: naik, xpDidapat: tambah, pet };
}

export async function gantiNamaPet(token, nama) {
  const bersih = String(nama || "").trim().slice(0, 20);
  if (!bersih) return { ok: false, error: "Nama tidak boleh kosong." };
  const col = await petsCol();
  await col.updateOne({ token }, { $set: { nama: bersih } });
  return { ok: true, nama: bersih };
}
