import { settingsCol } from "@/lib/db";
import { PROVIDER_KEYS, DEPOSIT_PROVIDERS } from "@/lib/paymentProviders";
import { OTP_SERVERS } from "@/lib/otpServers";

const SETTINGS_ID = "config";

const DEFAULTS = {
  markupPercent: Number(process.env.OTP_MARKUP_PERCENT || 0),
  maintenance: false,
  maintenanceMsg: "Website sedang maintenance. Kami akan segera kembali, mohon coba lagi beberapa saat lagi.",
  // Admin bisa menyalakan/mematikan tiap metode QRIS dari panel admin tanpa deploy ulang.
  depositProviders: { warungnokos: true, pakasir: true, rumahotp: false },
  // Persen biaya admin per metode — hanya ESTIMASI yang ditampilkan ke user sebelum
  // transaksi dibuat. Nominal pasti tetap dari respons resmi provider.
  depositFeePercent: { warungnokos: 0, pakasir: 0, rumahotp: 0.7 },
  // Tampilan tiap metode deposit — nama, label, keterangan, dan estimasi waktu
  // bisa diubah admin tanpa deploy ulang. Nilai awalnya dari lib/paymentProviders.js.
  depositMethods: DEPOSIT_PROVIDERS.map((p) => ({
    key: p.key,
    name: p.name,
    badge: "",
    desc: p.desc,
    speed: p.speed
  })),
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
  // Server OTP. Nama, label, dan keterangannya bisa diubah admin tanpa deploy
  // ulang — nilai awalnya diambil dari lib/otpServers.js.
  // markupPercent null = ikut markupPercent global.
  // offlineMsg kosong = pakai pesan bawaan saat server dimatikan.
  otpServers: OTP_SERVERS.map((s) => ({
    id: s.key,
    name: s.name,
    badge: s.badge,
    desc: s.desc,
    enabled: true,
    markupPercent: null,
    offlineMsg: ""
  })),
  // Transfer saldo antar pengguna. Admin bisa mematikan fitur ini kapan saja.
  // feePercent + feeFlat = biaya admin yang ditanggung PENGIRIM dan jadi
  // pendapatan pemilik web (penerima tetap dapat nominal penuh).
  transfer: { enabled: true, feePercent: 0, feeFlat: 0, minAmount: 1000, maxAmount: 0 },
  // Username Telegram customer service (tanpa @). Dipakai tombol CS di web & bot.
  csUsername: "teatlas",
  // Judul di halaman maintenance. Pesannya sendiri ada di maintenanceMsg.
  maintenanceTitle: "Sedang Maintenance",
  // Tombol/link opsional yang tampil di halaman maintenance.
  maintenanceButtonLabel: "",
  maintenanceButtonUrl: "",
  // Karakter hero di beranda — bisa diedit admin tanpa deploy ulang.
  heroChars: [
    { emoji: "🥷", name: "Gojo", accent: "#818cf8", glow: "#6366f1", sub: "Infinite Nokos ✨", line: "Dengan mata tak terbatas... aku melihat nokos paling murah!" },
    { emoji: "⚡", name: "Shadow", accent: "#fcd34d", glow: "#f59e0b", sub: "Shadow Clone OTP 🌀", line: "Seribu bayangan... semua beli OTP di Artapedia!" },
    { emoji: "🤖", name: "Cyber", accent: "#2dd4bf", glow: "#14b8a6", sub: 'System.execute("buy_nokos") 💻', line: "Sistem optimal: nokos cepat, harga minimal, proses instan!" },
    { emoji: "🦅", imageSrc: "/maskot.webp", name: "ARTA PEDIA SUPPORT", accent: "#FF6B1A", glow: "#2E86FF", sub: "Maskot Resmi ✦ Siap Bantu 24 Jam", line: "Halo! Aku ARTA PEDIA SUPPORT, elang penjaga web ini. Ada kendala nokos atau deposit? Panggil aku~" },
  ],
};

function mergeSettings(doc) {
  const docServers = Array.isArray(doc.otpServers) ? doc.otpServers : [];
  // Hanya server yang masih terdaftar di DEFAULTS. Entri provider lama yang sudah
  // dihapus dari kode tidak ikut muncul lagi di dashboard admin.
  const mergedServers = DEFAULTS.otpServers.map((def) => {
    const saved = docServers.find((s) => s.id === def.id);
    return saved ? { ...def, ...saved } : def;
  });

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
    depositMethods: DEFAULTS.depositMethods.map((def) => {
      const saved = (Array.isArray(doc.depositMethods) ? doc.depositMethods : []).find((m) => m.key === def.key);
      return saved ? { ...def, ...saved } : def;
    }),
    transfer: { ...DEFAULTS.transfer, ...(doc.transfer || {}) },
    csUsername: doc.csUsername || DEFAULTS.csUsername,
    maintenanceTitle: doc.maintenanceTitle || DEFAULTS.maintenanceTitle,
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
  if (patch.maintenanceMsg !== undefined) allowed.maintenanceMsg = String(patch.maintenanceMsg).slice(0, 600);
  if (patch.csUsername !== undefined) {
    allowed.csUsername = String(patch.csUsername).replace(/^@+/, "").trim().slice(0, 40) || "teatlas";
  }
  if (patch.maintenanceTitle !== undefined) {
    allowed.maintenanceTitle = String(patch.maintenanceTitle).slice(0, 80) || DEFAULTS.maintenanceTitle;
  }

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

  // Array kosong tidak pernah permintaan yang sah — mengabaikannya mencegah
  // seluruh markup & toggle server ter-reset kalau klien mengirim state kosong.
  if (Array.isArray(patch.otpServers) && patch.otpServers.length > 0) {
    allowed.otpServers = patch.otpServers
      .filter((s) => s && typeof s.id === "string")
      .slice(0, 20)
      .map((s) => ({
        id: String(s.id).slice(0, 50),
        name: String(s.name || s.id).slice(0, 60),
        badge: String(s.badge ?? "").slice(0, 20),
        desc: String(s.desc ?? "").slice(0, 300),
        // Pesan khusus saat server ini dimatikan. Kosong = pakai pesan bawaan.
        offlineMsg: String(s.offlineMsg ?? "").slice(0, 300),
        enabled: Boolean(s.enabled),
        // null / "" = ikut markup global, bukan 0%.
        markupPercent:
          s.markupPercent === null || s.markupPercent === undefined || s.markupPercent === ""
            ? null
            : Math.max(0, num(s.markupPercent))
      }));
  }

  if (patch.transfer && typeof patch.transfer === "object") {
    const t = patch.transfer;
    allowed.transfer = {
      ...current.transfer,
      ...(t.enabled !== undefined ? { enabled: Boolean(t.enabled) } : {}),
      ...(t.feePercent !== undefined ? { feePercent: Math.min(50, Math.max(0, num(t.feePercent))) } : {}),
      ...(t.feeFlat !== undefined ? { feeFlat: Math.max(0, Math.floor(num(t.feeFlat))) } : {}),
      ...(t.minAmount !== undefined ? { minAmount: Math.max(1, Math.floor(num(t.minAmount, 1000))) } : {}),
      // 0 = tanpa batas atas.
      ...(t.maxAmount !== undefined ? { maxAmount: Math.max(0, Math.floor(num(t.maxAmount))) } : {})
    };
  }

  // Array kosong tidak pernah permintaan yang sah — mengabaikannya mencegah
  // seluruh nama & label metode deposit ter-reset.
  if (Array.isArray(patch.depositMethods) && patch.depositMethods.length > 0) {
    allowed.depositMethods = patch.depositMethods
      .filter((m) => m && typeof m.key === "string" && PROVIDER_KEYS.includes(m.key))
      .slice(0, 20)
      .map((m) => ({
        key: String(m.key).slice(0, 50),
        name: String(m.name || m.key).slice(0, 60),
        badge: String(m.badge ?? "").slice(0, 20),
        desc: String(m.desc ?? "").slice(0, 300),
        speed: String(m.speed ?? "").slice(0, 40)
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

// Markup yang berlaku untuk satu server: markup khusus server kalau diisi,
// selain itu ikut markup global.
export function markupForServer(settings, serverId) {
  const list = Array.isArray(settings?.otpServers) ? settings.otpServers : [];
  const own = list.find((s) => s.id === serverId)?.markupPercent;
  const value = own === null || own === undefined || own === "" ? settings?.markupPercent : own;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

// Konfigurasi transfer yang sudah dinormalisasi — dipakai API & halaman transfer
// supaya angka yang dilihat user sama persis dengan yang dihitung server.
export function transferConfig(settings) {
  const t = settings?.transfer || {};
  const minAmount = Math.max(1, Math.floor(Number(t.minAmount) || 1000));
  const maxRaw = Math.floor(Number(t.maxAmount) || 0);
  return {
    enabled: t.enabled !== false,
    feePercent: Math.min(50, Math.max(0, Number(t.feePercent) || 0)),
    feeFlat: Math.max(0, Math.floor(Number(t.feeFlat) || 0)),
    minAmount,
    maxAmount: maxRaw > 0 ? Math.max(minAmount, maxRaw) : 0
  };
}

// Biaya admin untuk satu transfer. Dibulatkan ke atas ke kelipatan rupiah penuh
// supaya tidak pernah ada pecahan sen yang hilang.
export function transferFeeFor(settings, amount) {
  const cfg = transferConfig(settings);
  const amt = Math.max(0, Math.floor(Number(amount) || 0));
  const fee = Math.ceil((amt * cfg.feePercent) / 100) + cfg.feeFlat;
  return Math.max(0, fee);
}

// Info tampilan satu server, sudah menggabungkan pengaturan admin dengan nilai
// bawaan di lib/otpServers.js. Dipakai halaman beli nokos & API daftar server.
export function serverDisplay(settings, serverId) {
  const def = OTP_SERVERS.find((s) => s.key === serverId);
  const saved = (Array.isArray(settings?.otpServers) ? settings.otpServers : []).find((s) => s.id === serverId);
  return {
    key: serverId,
    name: saved?.name || def?.name || serverId,
    badge: saved?.badge ?? def?.badge ?? "",
    desc: saved?.desc ?? def?.desc ?? "",
    provider: def?.provider || "",
    enabled: saved?.enabled !== false,
    offlineMsg: saved?.offlineMsg || ""
  };
}

// Pesan yang ditampilkan saat server dimatikan admin.
export function serverOfflineMessage(settings, serverId) {
  const own = serverDisplay(settings, serverId).offlineMsg;
  return own || "Server ini sedang dinonaktifkan admin.";
}

// Info tampilan satu metode deposit, menggabungkan pengaturan admin dengan
// nilai bawaan di lib/paymentProviders.js.
export function depositDisplay(settings, key) {
  const def = DEPOSIT_PROVIDERS.find((p) => p.key === key);
  const saved = (Array.isArray(settings?.depositMethods) ? settings.depositMethods : []).find((m) => m.key === key);
  return {
    key,
    name: saved?.name || def?.name || key,
    badge: saved?.badge ?? "",
    desc: saved?.desc ?? def?.desc ?? "",
    speed: saved?.speed ?? def?.speed ?? ""
  };
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
