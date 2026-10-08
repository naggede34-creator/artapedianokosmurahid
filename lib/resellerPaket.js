// Paket & level reseller: slot bot tambahan, Premium, harga grosir, bonus target.
//
// Semua uang di sini keluar-masuk lewat saldo akun pemilik (users.balance) —
// bukan komisi bot — dan setiap perubahan dijaga dengan filter atomik di dalam
// findOneAndUpdate, sesuai pola di seluruh proyek: dua klik "beli" bersamaan
// tidak bisa sama-sama lolos dari saldo yang cuma cukup untuk satu.
//
// ── Level ────────────────────────────────────────────────────────────────
// Omzet = jumlah harga jual pesanan yang KODE OTP-nya benar-benar masuk
// (bukan sekadar dibeli): membeli lalu membatalkan lewat bot sendiri tidak
// menaikkan level dan tidak memicu bonus. Level bulan ini dan bulan lalu
// dipertahankan yang tertinggi, supaya awal bulan tidak terasa "turun pangkat".
import { usersCol, resellerKomisiCol, resellerBonusCol } from "@/lib/db";
import { catatPotongan } from "@/lib/saldoDeposit";
import { cfg } from "@/lib/config";
import { logBalance } from "@/lib/ledger";
import { umumkan } from "@/lib/notifyHub";
import { resellerBonusTargetNotif } from "@/lib/resellerNotif";

export const JATAH_BOT_DASAR = 3;
export const MARKUP_MAKS_DASAR = 100;

const angka = async (nama, bawaan) => {
  const mentah = String((await cfg(nama)) ?? "").trim();
  if (mentah === "") return bawaan; // tak terisi = bawaan, bukan 0
  const n = Number(mentah);
  return Number.isFinite(n) && n >= 0 ? n : bawaan;
};

// ── Murni (mudah diuji) ─────────────────────────────────────────────────────

/** "omzet:diskon:bonus,..." -> [{omzet, diskon, bonus}] urut naik menurut omzet. */
export function urai_tier(teks) {
  return String(teks || "")
    .split(",")
    .map((x) => x.trim().split(":"))
    .filter((p) => p.length === 3)
    .map(([o, d, b]) => ({ omzet: Number(o), diskon: Number(d), bonus: Number(b) }))
    .filter((t) => Number.isFinite(t.omzet) && t.omzet > 0 && Number.isFinite(t.diskon) && t.diskon >= 0 && Number.isFinite(t.bonus) && t.bonus >= 0)
    .sort((a, b) => a.omzet - b.omzet);
}

/** Indeks level tertinggi yang omzetnya sudah tercapai, -1 kalau belum ada. */
export function levelUntuk(omzet, tiers) {
  let idx = -1;
  tiers.forEach((t, i) => {
    if (omzet >= t.omzet) idx = i;
  });
  return idx;
}

/** Bulan menurut WIB, "2026-09". */
export function bulanWIB(d = new Date()) {
  const wib = new Date(d.getTime() + 7 * 3600 * 1000);
  return `${wib.getUTCFullYear()}-${String(wib.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Awal bulan WIB (sebagai Date UTC) dari kunci "YYYY-MM". */
export function awalBulanWIB(kunci) {
  const [y, m] = kunci.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1) - 7 * 3600 * 1000);
}

export function bulanLalu(kunci) {
  const [y, m] = kunci.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export const premiumAktif = (user, sekarang = Date.now()) =>
  Boolean(user?.premiumSampai && new Date(user.premiumSampai).getTime() > sekarang);

/**
 * Harga yang jadi modal reseller setelah potongan grosir. Tidak pernah di
 * bawah modal toko (`modalToko`) dan tidak pernah di atas harga situs.
 */
export function hargaModalGrosir(hargaSitus, diskonPersen, modalToko) {
  const situs = Math.max(0, Math.round(Number(hargaSitus) || 0));
  const d = Math.max(0, Number(diskonPersen) || 0);
  if (!situs || !d) return situs;
  const lantai = Math.max(0, Math.ceil(Number(modalToko) || 0));
  return Math.min(situs, Math.max(lantai, Math.floor(situs * (1 - d / 100))));
}

// ── Konfigurasi ─────────────────────────────────────────────────────────────

export async function ambilTier() {
  return urai_tier(await cfg("RESELLER_TIER"));
}

export async function konfigPaket() {
  return {
    slotHarga: await angka("RESELLER_SLOT_HARGA", 10000),
    slotMaks: await angka("RESELLER_SLOT_MAKS", 5),
    premiumHarga: await angka("RESELLER_PREMIUM_HARGA", 30000),
    premiumHari: Math.max(1, await angka("RESELLER_PREMIUM_HARI", 30)),
    premiumSlot: await angka("RESELLER_PREMIUM_SLOT", 2),
    premiumMarkupMaks: await angka("RESELLER_PREMIUM_MARKUP_MAKS", 200),
    premiumDiskon: await angka("RESELLER_PREMIUM_DISKON", 1)
  };
}

/** Batas bot & markup milik satu akun, dari slot yang dibeli dan Premium. */
export async function batasAkun(user) {
  const k = await konfigPaket();
  const prem = premiumAktif(user);
  return {
    maksBot: JATAH_BOT_DASAR + (Number(user?.slotTambahan) || 0) + (prem ? k.premiumSlot : 0),
    markupMaks: prem ? Math.max(MARKUP_MAKS_DASAR, k.premiumMarkupMaks) : MARKUP_MAKS_DASAR,
    premium: prem
  };
}

// ── Omzet & level ───────────────────────────────────────────────────────────

/** Omzet pesanan SELESAI (OTP masuk) dan tidak ditarik, dalam satu bulan WIB. */
export async function omzetBulan(pemilikToken, kunciBulan = bulanWIB()) {
  if (!pemilikToken) return 0;
  const col = await resellerKomisiCol();
  const dari = awalBulanWIB(kunciBulan);
  const [y, m] = kunciBulan.split("-").map(Number);
  const sampai = awalBulanWIB(`${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}`);
  const r = await col
    .aggregate([
      { $match: { pemilikToken, selesai: true, ditarik: { $ne: true }, createdAt: { $gte: dari, $lt: sampai } } },
      { $group: { _id: null, jumlah: { $sum: "$hargaJual" } } }
    ])
    .toArray();
  return Number(r[0]?.jumlah) || 0;
}

const cacheDiskon = new Map(); // pemilikToken -> {nilai, sampai}
const TTL_DISKON_MS = 60_000;

/** Potongan grosir (%) yang berlaku untuk satu pemilik saat ini. */
export async function diskonGrosir(pemilikToken) {
  if (!pemilikToken) return 0;
  const hit = cacheDiskon.get(pemilikToken);
  if (hit && hit.sampai > Date.now()) return hit.nilai;
  let nilai = 0;
  try {
    const tiers = await ambilTier();
    const ini = bulanWIB();
    const [o1, o2] = await Promise.all([omzetBulan(pemilikToken, ini), omzetBulan(pemilikToken, bulanLalu(ini))]);
    const idx = Math.max(levelUntuk(o1, tiers), levelUntuk(o2, tiers));
    nilai = idx >= 0 ? tiers[idx].diskon : 0;
    const user = await (await usersCol()).findOne({ token: pemilikToken }, { projection: { premiumSampai: 1 } });
    if (premiumAktif(user)) nilai += (await konfigPaket()).premiumDiskon;
  } catch (err) {
    // Potongan hanyalah bonus: gagal menghitungnya berarti tanpa potongan,
    // bukan pesanan yang gagal.
    console.error("[reseller] diskon grosir gagal dihitung:", err?.message || err);
    nilai = 0;
  }
  cacheDiskon.set(pemilikToken, { nilai, sampai: Date.now() + TTL_DISKON_MS });
  return nilai;
}

export function lupakanDiskon(pemilikToken) {
  cacheDiskon.delete(pemilikToken);
}

/** Ringkasan level untuk halaman reseller. */
export async function ringkasLevel(pemilikToken) {
  const tiers = await ambilTier();
  const ini = bulanWIB();
  const [omzetIni, omzetLalu] = await Promise.all([omzetBulan(pemilikToken, ini), omzetBulan(pemilikToken, bulanLalu(ini))]);
  const idxIni = levelUntuk(omzetIni, tiers);
  const idx = Math.max(idxIni, levelUntuk(omzetLalu, tiers));
  const berikut = tiers[idxIni + 1] || null;
  const bonusCol = await resellerBonusCol();
  const sudah = await bonusCol.find({ pemilikToken, bulan: ini }).toArray();
  return {
    bulan: ini,
    omzetIni,
    omzetLalu,
    level: idx + 1, // 0 = belum ada level
    diskonGrosir: idx >= 0 ? tiers[idx].diskon : 0,
    berikutnya: berikut ? { omzet: berikut.omzet, kurang: Math.max(0, berikut.omzet - omzetIni), bonus: berikut.bonus, diskon: berikut.diskon } : null,
    tiers: tiers.map((t, i) => ({ ...t, level: i + 1, tercapai: omzetIni >= t.omzet, bonusDiterima: sudah.some((b) => b.tier === i) }))
  };
}

/**
 * Dipanggil saat kode OTP sebuah pesanan reseller MASUK: menandai komisinya
 * selesai (mulai dihitung sebagai omzet) lalu memeriksa bonus target.
 * Idempoten — hanya panggilan pertama yang menandai. Tidak pernah melempar.
 */
export async function pesananResellerSelesai(orderId) {
  try {
    const col = await resellerKomisiCol();
    // Komisi web reseller dikreditkan ke dompet pemilik DULU (idempoten), baru log ditandai selesai:
    // proses yang mati di tengah aman diulang, dan tidak pernah ganda maupun hilang.
    const calon = await col.findOne({ orderId: String(orderId), selesai: { $ne: true }, ditarik: { $ne: true } });
    if (!calon) return [];
    if (String(calon.botId).startsWith("web:")) await (await import("@/lib/webReseller")).komisiSelesai(calon);
    const dok = await col.findOneAndUpdate(
      { orderId: String(orderId), selesai: { $ne: true }, ditarik: { $ne: true } },
      { $set: { selesai: true, selesaiAt: new Date() } },
      { returnDocument: "after" }
    );
    if (!dok) return [];
    // Bonus target level adalah program bot reseller; pesanan web reseller tidak ikut menghitungnya.
    if (String(dok.botId).startsWith("web:")) return [];
    return await periksaBonusTarget(dok.pemilikToken);
  } catch (err) {
    console.error("[reseller] gagal menandai pesanan selesai:", err?.message || err);
    return [];
  }
}

// ── Bonus target ────────────────────────────────────────────────────────────

/**
 * Dipanggil setiap kali satu pesanan reseller SELESAI. Membayar bonus untuk
 * tiap level yang baru tercapai bulan ini — sekali per (pemilik, bulan, level),
 * dijamin indeks unik: dicatat DULU, saldo ditambah SESUDAH.
 * Tidak pernah melempar.
 */
export async function periksaBonusTarget(pemilikToken) {
  try {
    if (!pemilikToken) return [];
    lupakanDiskon(pemilikToken);
    const tiers = await ambilTier();
    if (!tiers.length) return [];
    const bulan = bulanWIB();
    const omzet = await omzetBulan(pemilikToken, bulan);
    const idx = levelUntuk(omzet, tiers);
    const dibayar = [];
    const bonusCol = await resellerBonusCol();
    const users = await usersCol();
    for (let i = 0; i <= idx; i++) {
      const t = tiers[i];
      if (!(t.bonus > 0)) continue;
      try {
        await bonusCol.insertOne({
          kunci: `${pemilikToken}|${bulan}|${i}`,
          pemilikToken,
          bulan,
          tier: i,
          omzet,
          bonus: t.bonus,
          createdAt: new Date()
        });
      } catch (err) {
        if (err?.code === 11000) continue; // sudah dibayar
        throw err;
      }
      const u = await users.findOneAndUpdate({ token: pemilikToken }, { $inc: { balance: t.bonus } }, { returnDocument: "after" });
      await logBalance({
        token: pemilikToken,
        type: "reseller_bonus",
        amount: t.bonus,
        balanceAfter: u?.balance,
        title: `Bonus target reseller level ${i + 1} (${bulan})`,
        ref: `${bulan}-L${i + 1}`
      });
      dibayar.push({ level: i + 1, bonus: t.bonus });
      umumkan({
        jenis: "reseller_bonus",
        admin: resellerBonusTargetNotif({ pemilikToken, level: i + 1, bonus: t.bonus, omzet, bulan })
      }).catch(() => {});
    }
    return dibayar;
  } catch (err) {
    console.error("[reseller] bonus target gagal:", err?.message || err);
    return [];
  }
}

// ── Pembelian paket ─────────────────────────────────────────────────────────

/** Beli satu slot bot tambahan (permanen). */
export async function beliSlot(token) {
  const k = await konfigPaket();
  if (!(k.slotHarga > 0)) return { ok: false, alasan: "Penjualan slot sedang tidak dibuka." };
  const users = await usersCol();
  // Batas & saldo DI DALAM filter: klik ganda tidak bisa melewati keduanya.
  const u = await users.findOneAndUpdate(
    {
      token,
      suspended: { $ne: true },
      balance: { $gte: k.slotHarga },
      $or: [{ slotTambahan: { $lt: k.slotMaks } }, { slotTambahan: { $exists: false } }]
    },
    { $inc: { balance: -k.slotHarga, slotTambahan: 1 } },
    { returnDocument: "after" }
  );
  if (u) await catatPotongan(token, u, k.slotHarga);
  if (!u) {
    const a = await users.findOne({ token }, { projection: { balance: 1, slotTambahan: 1, suspended: 1 } });
    if (!a) return { ok: false, alasan: "Akun tidak ditemukan." };
    if (a.suspended) return { ok: false, alasan: "Akun ditangguhkan." };
    if ((Number(a.slotTambahan) || 0) >= k.slotMaks) return { ok: false, alasan: `Maksimal ${k.slotMaks} slot tambahan.` };
    return { ok: false, alasan: `Saldo kurang. Slot tambahan Rp${k.slotHarga.toLocaleString("id-ID")}.`, kurang: k.slotHarga - (Number(a.balance) || 0) };
  }
  await logBalance({ token, type: "reseller_slot", amount: -k.slotHarga, balanceAfter: u.balance, title: `Slot bot tambahan #${u.slotTambahan}`, ref: `slot-${u.slotTambahan}` });
  return { ok: true, saldo: u.balance, slotTambahan: u.slotTambahan };
}

/** Beli/perpanjang Premium. Perpanjangan menyambung dari masa aktif yang tersisa. */
export async function beliPremium(token, sekarang = new Date()) {
  const k = await konfigPaket();
  if (!(k.premiumHarga > 0)) return { ok: false, alasan: "Paket Premium sedang tidak dibuka." };
  const users = await usersCol();
  const sebelum = await users.findOne({ token }, { projection: { premiumSampai: 1 } });
  if (!sebelum) return { ok: false, alasan: "Akun tidak ditemukan." };
  const dasar = premiumAktif(sebelum, sekarang.getTime()) ? new Date(sebelum.premiumSampai) : sekarang;
  const sampai = new Date(dasar.getTime() + k.premiumHari * 24 * 3600 * 1000);
  // Filter menyertakan premiumSampai yang tadi dibaca: kalau ada klik ganda,
  // hanya satu yang cocok — yang kedua melihat nilainya sudah berubah.
  const u = await users.findOneAndUpdate(
    { token, suspended: { $ne: true }, balance: { $gte: k.premiumHarga }, premiumSampai: sebelum.premiumSampai ?? null },
    { $inc: { balance: -k.premiumHarga }, $set: { premiumSampai: sampai } },
    { returnDocument: "after" }
  );
  if (u) await catatPotongan(token, u, k.premiumHarga);
  if (!u) {
    const a = await users.findOne({ token }, { projection: { balance: 1, suspended: 1 } });
    if (a?.suspended) return { ok: false, alasan: "Akun ditangguhkan." };
    if ((Number(a?.balance) || 0) < k.premiumHarga) {
      return { ok: false, alasan: `Saldo kurang. Premium Rp${k.premiumHarga.toLocaleString("id-ID")}.`, kurang: k.premiumHarga - (Number(a?.balance) || 0) };
    }
    return { ok: false, alasan: "Permintaan bersamaan terdeteksi. Muat ulang lalu coba lagi." };
  }
  lupakanDiskon(token);
  await logBalance({ token, type: "reseller_premium", amount: -k.premiumHarga, balanceAfter: u.balance, title: `Paket Premium ${k.premiumHari} hari`, ref: `prem-${sampai.toISOString().slice(0, 10)}` });
  return { ok: true, saldo: u.balance, premiumSampai: sampai };
}
