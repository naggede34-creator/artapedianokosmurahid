import { settingsCol } from "@/lib/db";

const SETTINGS_ID = "config";

const DEFAULTS = {
  markupPercent: Number(process.env.OTP_MARKUP_PERCENT || 0),
  maintenance: false,
  maintenanceMsg: "Website sedang maintenance. Kami akan segera kembali, mohon coba lagi beberapa saat lagi.",
  // Admin bisa nyalain salah satu, dua-duanya, atau (kalau lagi mau nonaktifin semua
  // metode QRIS sementara) matiin semua dari panel admin tanpa perlu deploy ulang.
  depositProviders: { pakasir: true, rumahotp: false },
  // Persen biaya admin per metode, cuma dipakai untuk ESTIMASI yang ditampilkan ke
  // user di halaman deposit (mis. "Biaya admin 0.7%") sebelum transaksi dibuat.
  // Nominal PASTI yang dipotong tetap dari respons resmi provider saat createDeposit,
  // bukan dihitung ulang dari angka ini.
  depositFeePercent: { pakasir: 0, rumahotp: 0.7 },
  // Program loyalitas: poin didapat dari transaksi OTP yang sukses (status "done"),
  // cashback didapat langsung tiap deposit berhasil, dan badge dihitung dari total
  // nominal transaksi OTP sukses sepanjang waktu (bukan dari deposit).
  loyalty: {
    pointsPerRupiah: 1, // poin didapat per Rp1.000 nilai transaksi OTP sukses
    pointRupiahValue: 10, // 1 poin ditukar jadi berapa rupiah saldo
    minRedeemPoints: 100,
    cashbackDepositPercent: 1,
    badgeThresholds: { silver: 100000, gold: 500000 }
  }
};

// Diambil dari DB supaya bisa diubah admin tanpa deploy ulang. Kalau dokumennya
// belum ada (misal baru pertama kali jalan), otomatis dibuat dari nilai default.
export async function getSettings() {
  const col = await settingsCol();
  const doc = await col.findOne({ _id: SETTINGS_ID });
  if (!doc) {
    const fresh = { _id: SETTINGS_ID, ...DEFAULTS, updatedAt: new Date() };
    await col.insertOne(fresh);
    return fresh;
  }
  // Merge dangkal biasa untuk field-field lain, tapi depositProviders di-merge manual
  // per-key supaya kalau dokumen lama di DB cuma punya salah satu provider (mis. dari
  // sebelum RumahOTP ditambahkan), key yang belum ada tetap dapat nilai default-nya,
  // bukan hilang jadi undefined.
  return {
    ...DEFAULTS,
    ...doc,
    depositProviders: { ...DEFAULTS.depositProviders, ...(doc.depositProviders || {}) },
    depositFeePercent: { ...DEFAULTS.depositFeePercent, ...(doc.depositFeePercent || {}) },
    loyalty: {
      ...DEFAULTS.loyalty,
      ...(doc.loyalty || {}),
      badgeThresholds: { ...DEFAULTS.loyalty.badgeThresholds, ...(doc.loyalty?.badgeThresholds || {}) }
    }
  };
}

export async function updateSettings(patch) {
  const col = await settingsCol();
  const allowed = {};
  if (patch.markupPercent !== undefined) allowed.markupPercent = Number(patch.markupPercent) || 0;
  if (patch.maintenance !== undefined) allowed.maintenance = Boolean(patch.maintenance);
  if (patch.maintenanceMsg !== undefined) allowed.maintenanceMsg = String(patch.maintenanceMsg).slice(0, 300);
  if (patch.depositProviders !== undefined && typeof patch.depositProviders === "object") {
    const current = await getSettings();
    allowed.depositProviders = {
      ...current.depositProviders,
      ...(patch.depositProviders.pakasir !== undefined ? { pakasir: Boolean(patch.depositProviders.pakasir) } : {}),
      ...(patch.depositProviders.rumahotp !== undefined ? { rumahotp: Boolean(patch.depositProviders.rumahotp) } : {})
    };
  }
  if (patch.depositFeePercent !== undefined && typeof patch.depositFeePercent === "object") {
    const current = await getSettings();
    allowed.depositFeePercent = {
      ...current.depositFeePercent,
      ...(patch.depositFeePercent.pakasir !== undefined ? { pakasir: Number(patch.depositFeePercent.pakasir) || 0 } : {}),
      ...(patch.depositFeePercent.rumahotp !== undefined ? { rumahotp: Number(patch.depositFeePercent.rumahotp) || 0 } : {})
    };
  }

  if (patch.loyalty !== undefined && typeof patch.loyalty === "object") {
    const current = await getSettings();
    const l = patch.loyalty;
    allowed.loyalty = {
      ...current.loyalty,
      ...(l.pointsPerRupiah !== undefined ? { pointsPerRupiah: Number(l.pointsPerRupiah) || 0 } : {}),
      ...(l.pointRupiahValue !== undefined ? { pointRupiahValue: Number(l.pointRupiahValue) || 0 } : {}),
      ...(l.minRedeemPoints !== undefined ? { minRedeemPoints: Math.max(1, Number(l.minRedeemPoints) || 1) } : {}),
      ...(l.cashbackDepositPercent !== undefined ? { cashbackDepositPercent: Number(l.cashbackDepositPercent) || 0 } : {}),
      badgeThresholds: {
        ...current.loyalty.badgeThresholds,
        ...(l.badgeThresholds?.silver !== undefined ? { silver: Number(l.badgeThresholds.silver) || 0 } : {}),
        ...(l.badgeThresholds?.gold !== undefined ? { gold: Number(l.badgeThresholds.gold) || 0 } : {})
      }
    };
  }

  await col.updateOne(
    { _id: SETTINGS_ID },
    { $set: { ...allowed, updatedAt: new Date() }, $setOnInsert: { _id: SETTINGS_ID } },
    { upsert: true }
  );
  return getSettings();
}
