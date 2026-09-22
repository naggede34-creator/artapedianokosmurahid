import { settingsCol } from "@/lib/db";
import { PROVIDER_KEYS } from "@/lib/paymentProviders";

const SETTINGS_ID = "config";

const DEFAULTS = {
  markupPercent: Number(process.env.OTP_MARKUP_PERCENT || 0),
  maintenance: false,
  maintenanceMsg: "Website sedang maintenance. Kami akan segera kembali, mohon coba lagi beberapa saat lagi.",
  // Admin bisa menyalakan/mematikan tiap metode QRIS dari panel admin tanpa deploy ulang.
  depositProviders: { otpmania: true, pakasir: true, rumahotp: false },
  // Persen biaya admin per metode — hanya ESTIMASI yang ditampilkan ke user sebelum
  // transaksi dibuat. Nominal pasti tetap dari respons resmi provider.
  depositFeePercent: { otpmania: 0, pakasir: 0, rumahotp: 0.7 },
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
  // Server OTP yang aktif — admin bisa aktif/nonaktifkan dari dashboard.
  otpServers: [
    { id: "rumahotp", name: "RumahOTP", enabled: true },
    { id: "otpmania_s2", name: "Server Plus", enabled: true },
    { id: "otpmania_s1", name: "Server Express", enabled: true }
  ],
  // Tombol/link opsional yang tampil di halaman maintenance.
  maintenanceButtonLabel: "",
  maintenanceButtonUrl: "",
  // Karakter hero di beranda — bisa diedit admin tanpa deploy ulang.
  heroChars: [
    { emoji: "🥷", name: "Gojo", accent: "#818cf8", glow: "#6366f1", sub: "Infinite Nokos ✨", line: "Dengan mata tak terbatas... aku melihat nokos paling murah!" },
    { emoji: "⚡", name: "Shadow", accent: "#fcd34d", glow: "#f59e0b", sub: "Shadow Clone OTP 🌀", line: "Seribu bayangan... semua beli OTP di Artapedia!" },
    { emoji: "🤖", name: "Cyber", accent: "#2dd4bf", glow: "#14b8a6", sub: 'System.execute("buy_nokos") 💻', line: "Sistem optimal: nokos cepat, harga minimal, proses instan!" },
    { emoji: "🌸", name: "Aria", accent: "#fb7185", glow: "#f43f5e", sub: "Magic Bonus ✦ +EXP", line: "Abrakadabra! Saldo kamu bertambah dengan tiap transaksi bersama ku~" },
  ],
};

function mergeSettings(doc) {
  const defaultServerIds = new Set(DEFAULTS.otpServers.map((s) => s.id));
  const docServers = Array.isArray(doc.otpServers) ? doc.otpServers : [];
  const mergedServers = DEFAULTS.otpServers.map((def) => {
    const saved = docServers.find((s) => s.id === def.id);
    return saved ? { ...def, ...saved } : def;
  });
  // Tambah server baru dari DB yang belum ada di DEFAULTS (future-proof).
  for (const s of docServers) {
    if (!defaultServerIds.has(s.id)) mergedServers.push(s);
  }

  return {
    ...DEFAULTS,
    ...doc,
    depositProviders: { ...DEFAULTS.depositProviders, ...(doc.depositProviders || {}) },
    depositFeePercent: { ...DEFAULTS.depositFeePercent, ...(doc.depositFeePercent || {}) },
    loyalty: {
      ...DEFAULTS.loyalty,
      ...(doc.loyalty || {}),
      badgeThresholds: { ...DEFAULTS.loyalty.badgeThresholds, ...(doc.loyalty?.badgeThresholds || {}) }
    },
    otpServers: mergedServers,
    maintenanceButtonLabel: doc.maintenanceButtonLabel ?? DEFAULTS.maintenanceButtonLabel,
    maintenanceButtonUrl: doc.maintenanceButtonUrl ?? DEFAULTS.maintenanceButtonUrl,
    heroChars: Array.isArray(doc.heroChars) && doc.heroChars.length > 0 ? doc.heroChars : DEFAULTS.heroChars,
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

  if (Array.isArray(patch.otpServers)) {
    allowed.otpServers = patch.otpServers
      .filter((s) => s && typeof s.id === "string")
      .slice(0, 20)
      .map((s) => ({
        id: String(s.id).slice(0, 50),
        name: String(s.name || s.id).slice(0, 100),
        enabled: Boolean(s.enabled)
      }));
  }

  if (patch.maintenanceButtonLabel !== undefined) {
    allowed.maintenanceButtonLabel = String(patch.maintenanceButtonLabel).slice(0, 100);
  }
  if (patch.maintenanceButtonUrl !== undefined) {
    allowed.maintenanceButtonUrl = String(patch.maintenanceButtonUrl).trim().slice(0, 500);
  }

  if (Array.isArray(patch.heroChars)) {
    allowed.heroChars = patch.heroChars.slice(0, 6).map((c) => {
      const char = {
        emoji: String(c.emoji || "⭐").slice(0, 8),
        name:  String(c.name  || "").slice(0, 20),
        accent: String(c.accent || "#818cf8").slice(0, 12),
        glow:   String(c.glow  || "#6366f1").slice(0, 12),
        sub:  String(c.sub  || "").slice(0, 80),
        line: String(c.line || "").slice(0, 200),
      };
      // imageSrc: base64 data URL atau URL eksternal (maks 300KB)
      if (c.imageSrc && typeof c.imageSrc === "string") {
        const src = c.imageSrc.trim();
        if (src.startsWith("data:image/") || src.startsWith("http")) {
          char.imageSrc = src.slice(0, 307200); // 300KB max
        }
      }
      return char;
    });
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

export async function getDepositLimits() {
  const s = await getSettings();
  return {
    min: Math.max(1, s.depositMin || 2000),
    max: Math.max(1, s.depositMax || 1000000)
  };
}
