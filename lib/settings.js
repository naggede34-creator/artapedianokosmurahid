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
  // Fitur reseller web (Buat Web Nokos).
  reseller: {
    enabled: true,
  },
  // Program loyalitas: poin dari transaksi sukses, cashback dari deposit, badge dari total belanja.
  loyalty: {
    pointsPerRupiah: 1,
    pointRupiahValue: 10,
    minRedeemPoints: 100,
    cashbackDepositPercent: 1,
    badgeThresholds: { silver: 100000, gold: 500000 }
  },
  // Konfigurasi situs — bisa di-override dari dashboard admin, fallback ke env.
  siteName: process.env.NEXT_PUBLIC_SITE_NAME || "Nokos Murah",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "",
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || "",
  telegramChatId: process.env.TELEGRAM_CHAT_ID || "",
  telegramChannelId: process.env.TELEGRAM_CHANNEL_ID || "",
  depositMin: Number(process.env.DEPOSIT_MIN_AMOUNT || 2000),
  depositMax: Number(process.env.DEPOSIT_MAX_AMOUNT || 1000000),
};

function mergeSettings(doc) {
  return {
    ...DEFAULTS,
    ...doc,
    depositProviders: { ...DEFAULTS.depositProviders, ...(doc.depositProviders || {}) },
    depositFeePercent: { ...DEFAULTS.depositFeePercent, ...(doc.depositFeePercent || {}) },
    smm: { ...DEFAULTS.smm, ...(doc.smm || {}) },
    reseller: { ...DEFAULTS.reseller, ...(doc.reseller || {}) },
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

  if (patch.reseller && typeof patch.reseller === "object") {
    allowed.reseller = {
      ...current.reseller,
      ...(patch.reseller.enabled !== undefined ? { enabled: Boolean(patch.reseller.enabled) } : {}),
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

  if (patch.siteName !== undefined) allowed.siteName = String(patch.siteName).slice(0, 100);
  if (patch.siteUrl !== undefined) allowed.siteUrl = String(patch.siteUrl).slice(0, 255);
  if (patch.telegramBotToken !== undefined) allowed.telegramBotToken = String(patch.telegramBotToken).slice(0, 200);
  if (patch.telegramChatId !== undefined) allowed.telegramChatId = String(patch.telegramChatId).slice(0, 50);
  if (patch.telegramChannelId !== undefined) allowed.telegramChannelId = String(patch.telegramChannelId).slice(0, 50);
  if (patch.depositMin !== undefined) allowed.depositMin = Math.max(1, num(patch.depositMin, 2000));
  if (patch.depositMax !== undefined) allowed.depositMax = Math.max(1, num(patch.depositMax, 1000000));

  await col.updateOne({ _id: SETTINGS_ID }, { $set: { ...allowed, updatedAt: new Date() } }, { upsert: true });
  return getSettings();
}

export function depositLimits() {
  return {
    min: Math.max(2000, Number(process.env.DEPOSIT_MIN_AMOUNT || 2000)),
    max: Number(process.env.DEPOSIT_MAX_AMOUNT || 1000000)
  };
}

export async function getDepositLimits() {
  const s = await getSettings();
  return {
    min: Math.max(1, s.depositMin || 2000),
    max: Math.max(1, s.depositMax || 1000000)
  };
}
