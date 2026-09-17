import { settingsCol } from "@/lib/db";
import { PROVIDER_KEYS } from "@/lib/paymentProviders";

const SETTINGS_ID = "config";

const DEFAULTS = {
  markupPercent: Number(process.env.OTP_MARKUP_PERCENT || 0),
  maintenance: false,
  maintenanceMsg: "Website sedang maintenance. Kami akan segera kembali, mohon coba lagi beberapa saat lagi.",
  // Admin bisa menyalakan/mematikan tiap metode QRIS dari panel admin tanpa deploy ulang.
  depositProviders: { simuru: true, pakasir: true, rumahotp: false },
  // Persen biaya admin per metode — hanya ESTIMASI yang ditampilkan ke user sebelum
  // transaksi dibuat. Nominal pasti tetap dari respons resmi provider.
  depositFeePercent: { simuru: 0, pakasir: 0, rumahotp: 0.7 },
  // Suntik sosmed (SMM via Simuru).
  smm: {
    enabled: true,
    markupPercent: Number(process.env.SMM_MARKUP_PERCENT || 0)
  },
  // Program loyalitas: poin dari transaksi sukses, cashback dari deposit, badge dari total belanja.
  loyalty: {
    pointsPerRupiah: 1,
    pointRupiahValue: 10,
    minRedeemPoints: 100,
    cashbackDepositPercent: 1,
    badgeThresholds: { silver: 100000, gold: 500000 }
  }
};

function mergeSettings(doc) {
  return {
    ...DEFAULTS,
    ...doc,
    depositProviders: { ...DEFAULTS.depositProviders, ...(doc.depositProviders || {}) },
    depositFeePercent: { ...DEFAULTS.depositFeePercent, ...(doc.depositFeePercent || {}) },
    smm: { ...DEFAULTS.smm, ...(doc.smm || {}) },
    loyalty: {
      ...DEFAULTS.loyalty,
      ...(doc.loyalty || {}),
      badgeThresholds: { ...DEFAULTS.loyalty.badgeThresholds, ...(doc.loyalty?.badgeThresholds || {}) }
    }
  };
}

// Diambil dari DB supaya bisa diubah admin tanpa deploy ulang.
export async function getSettings() {
  const col = await settingsCol();
  const doc = await col.findOne({ _id: SETTINGS_ID });
  if (!doc) {
    const fresh = { _id: SETTINGS_ID, ...DEFAULTS, updatedAt: new Date() };
    await col.updateOne({ _id: SETTINGS_ID }, { $setOnInsert: fresh }, { upsert: true });
    return mergeSettings(fresh);
  }
  return mergeSettings(doc);
}

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export async function updateSettings(patch) {
  const col = await settingsCol();
  const current = await getSettings();
  const allowed = {};

  if (patch.markupPercent !== undefined) allowed.markupPercent = Math.max(0, num(patch.markupPercent));
  if (patch.maintenance !== undefined) allowed.maintenance = Boolean(patch.maintenance);
  if (patch.maintenanceMsg !== undefined) allowed.maintenanceMsg = String(patch.maintenanceMsg).slice(0, 300);

  if (patch.depositProviders && typeof patch.depositProviders === "object") {
    const next = { ...current.depositProviders };
    for (const key of PROVIDER_KEYS) {
      if (patch.depositProviders[key] !== undefined) next[key] = Boolean(patch.depositProviders[key]);
    }
    allowed.depositProviders = next;
  }

  if (patch.depositFeePercent && typeof patch.depositFeePercent === "object") {
    const next = { ...current.depositFeePercent };
    for (const key of PROVIDER_KEYS) {
      if (patch.depositFeePercent[key] !== undefined) {
        next[key] = Math.min(100, Math.max(0, num(patch.depositFeePercent[key])));
      }
    }
    allowed.depositFeePercent = next;
  }

  if (patch.smm && typeof patch.smm === "object") {
    allowed.smm = {
      ...current.smm,
      ...(patch.smm.enabled !== undefined ? { enabled: Boolean(patch.smm.enabled) } : {}),
      ...(patch.smm.markupPercent !== undefined ? { markupPercent: Math.max(0, num(patch.smm.markupPercent)) } : {})
    };
  }

  if (patch.loyalty && typeof patch.loyalty === "object") {
    const l = patch.loyalty;
    allowed.loyalty = {
      ...current.loyalty,
      ...(l.pointsPerRupiah !== undefined ? { pointsPerRupiah: Math.max(0, num(l.pointsPerRupiah)) } : {}),
      ...(l.pointRupiahValue !== undefined ? { pointRupiahValue: Math.max(0, num(l.pointRupiahValue)) } : {}),
      ...(l.minRedeemPoints !== undefined ? { minRedeemPoints: Math.max(1, num(l.minRedeemPoints, 1)) } : {}),
      ...(l.cashbackDepositPercent !== undefined ? { cashbackDepositPercent: Math.max(0, num(l.cashbackDepositPercent)) } : {}),
      badgeThresholds: {
        ...current.loyalty.badgeThresholds,
        ...(l.badgeThresholds?.silver !== undefined ? { silver: Math.max(0, num(l.badgeThresholds.silver)) } : {}),
        ...(l.badgeThresholds?.gold !== undefined ? { gold: Math.max(0, num(l.badgeThresholds.gold)) } : {})
      }
    };
  }

  await col.updateOne({ _id: SETTINGS_ID }, { $set: { ...allowed, updatedAt: new Date() } }, { upsert: true });
  return getSettings();
}

export function depositLimits() {
  return {
    min: Math.max(2000, Number(process.env.DEPOSIT_MIN_AMOUNT || 2000)),
    max: Number(process.env.DEPOSIT_MAX_AMOUNT || 1000000)
  };
}
