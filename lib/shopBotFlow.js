// Alur percakapan BOT TOKO Artapedia.
//
// Prinsip yang dipegang:
//  - Saldo TIDAK pernah dihitung ulang di sini. Order memakai placeOtpOrder dan
//    deposit memakai createDepositForToken / syncDeposit yang sama dengan web,
//    dipanggil langsung di proses ini. Bot tidak menembak HTTP ke dirinya
//    sendiri, jadi tidak ada alamat website yang bisa salah isi atau kosong.
//  - Data callback Telegram dibatasi 64 byte, jadi daftar layanan/negara
//    disimpan di sesi dan tombolnya hanya mengirim nomor urut.
import { usersCol } from "@/lib/db";
import {
  getSettings,
  serverDisplay,
  serverOfflineMessage,
  depositDisplay,
  markupForServer,
  manualDepositReady,
  manualDepositHours
} from "@/lib/settings";
import { OTP_SERVERS } from "@/lib/otpServers";
import { PROVIDER_KEYS, MANUAL_DEPOSIT_KEY } from "@/lib/paymentProviders";
import { atlanticConfigured } from "@/lib/atlantic";
import { listServices, listCountries } from "@/lib/otpCatalog";
import { placeOtpOrder, cancelOtpOrder, CANCEL_COOLDOWN_MS } from "@/lib/otpOrderService";
import { createDepositForToken, cancelDepositForToken, confirmManualDeposit } from "@/lib/depositOrderService";
import { syncDeposit } from "@/lib/depositService";
import { reconcileOtpOrder } from "@/lib/orderReconcile";
import { otpOrdersCol, depositsCol } from "@/lib/db";
import { generateUserToken } from "@/lib/token";
import { newUserNotif } from "@/lib/telegram";
import { umumkan } from "@/lib/notifyHub";
import {
  sendMessage,
  editMessage,
  answerCallback,
  sendQrPhoto,
  sendLocalPhoto,
  sendChatAction,
  deleteMessage,
  startLoading,
  getSession,
  setSession,
  clearStep,
  isShopBotOwner,
  rupiah,
  esc,
  head,
  row,
  panel,
  panelRow,
  PANEL_SEP,
  bar,
  foot,
  RULE,
  RULE_THIN,
  downloadPhotoAsDataUrl
} from "@/lib/shopBot";

const PER_PAGE = 8;

// Aplikasi yang paling sering diminta. `q` dicocokkan ke nama layanan apa
// adanya, jadi tetap bekerja walau tiap provider menamai layanannya berbeda.
const POPULAR = [
  { label: "💚 WhatsApp", q: "whatsapp" },
  { label: "💙 Telegram", q: "telegram" },
  { label: "🛵 Gojek", q: "gojek" },
  { label: "🛍 Shopee", q: "shopee" },
  { label: "💳 DANA", q: "dana" },
  { label: "🚕 Grab", q: "grab" }
];

function csUsername(settings) {
  return (settings?.csUsername || "teatlas").replace(/^@/, "");
}

// Hanya dipakai untuk tombol "Buka Website" — tidak ada alur uang yang
// bergantung padanya. Vercel selalu menyediakan dua env var terakhir, jadi
// tombolnya tetap muncul walau admin belum mengisi Site URL.
function siteUrl(settings) {
  const fromVercel = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || "";
  const raw =
    settings?.siteUrl ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    (fromVercel ? `https://${fromVercel}` : "");
  return String(raw).replace(/\/+$/, "");
}

// Tujuan tombol "Buka Website Arta Pedia" di menu utama.
//
// Ini Mini App Telegram, bukan alamat situsnya. Sengaja dipisah dari
// siteUrl(): siteUrl dipakai untuk alamat situs yang sebenarnya (dan bisa
// diganti admin lewat Pengaturan Situs), sedangkan alamat Mini App melekat
// pada bot dan tidak ikut berubah kalau domain situsnya pindah.
// Kalau alamat Mini App-nya berganti, ganti di sini saja.
const WEBAPP_URL = "https://t.me/artapediaofcidbot/artapediaidnokos";

// Tombol bantuan yang selalu ada di menu utama.
function csButton(settings) {
  return { text: "💬 Customer Service", url: `https://t.me/${csUsername(settings)}` };
}

async function linkedUser(session) {
  if (!session?.token) return null;
  const users = await usersCol();
  return users.findOne({ token: session.token });
}

// ─────────────────────────── MENU UTAMA ───────────────────────────

const BANNER = "public/bot-welcome.jpg";

// Tombol menu utama, dipakai layar sambutan maupun menu. Satu sumber supaya
// menu tidak berbeda isi antara /start dan tombol "Menu".
function menuKeyboard(settings, user, { forOwner = false } = {}) {
  const rows = [
    [
      { text: "🛒 BELI NOKOS", callback_data: "buy" },
      { text: "💳 DEPOSIT", callback_data: "dep" }
    ],
    user
      ? [
          { text: "🧾 Pesanan Saya", callback_data: "orders" },
          { text: "👤 Akun & Saldo", callback_data: "acc" }
        ]
      : [
          { text: "🔑 Login Kode Akun", callback_data: "login" },
          { text: "✨ Buat Akun Gratis", callback_data: "reg" }
        ],
    [
      { text: "📊 Status Server", callback_data: "srvstat" },
      { text: "❓ Cara Pakai", callback_data: "howto" }
    ],
    [
      { text: "ℹ️ Informasi", callback_data: "info" },
      { text: "💬 Customer Service", url: `https://t.me/${csUsername(settings)}` }
    ]
  ];

  rows.push([{ text: "🌐 Buka Website Arta Pedia", url: WEBAPP_URL }]);
  if (forOwner) rows.push([{ text: "🛠 Panel Admin", callback_data: "adm" }]);
  return rows;
}

// Layar sambutan /start: banner komik + ringkasan + seluruh menu.
//
// Pesan foto tidak bisa diubah jadi pesan teks (dan sebaliknya), jadi animasi
// tunggunya dihapus dulu sebelum banner dikirim — kalau tidak, chat-nya
// menyisakan bar progres yang menggantung di atas banner.
export async function showWelcome(chatId, from = null) {
  await clearStep(chatId);
  sendChatAction(chatId, "upload_photo");

  const memuat = await startLoading(chatId, "🦅 <b>Menyiapkan Arta Pedia…</b>");

  const settings = await getSettings();
  const session = await getSession(chatId);
  const user = await linkedUser(session);

  const nama = esc(from?.first_name || "Kak");
  const aktif = OTP_SERVERS.filter((s) => serverDisplay(settings, s.key).enabled).length;

  const caption =
    head("🦅", `Halo ${nama}`, "Arta Pedia ID · nokos termurah dan fast") +
    `\n` +
    (user
      ? `💰  <b>${rupiah(user.balance)}</b>\n\n` +
        panel([
          panelRow("Kode akun", user.token),
          panelRow("Server aktif", String(aktif)),
          panelRow("Layanan", "24 jam nonstop")
        ]) +
        `\nSaldomu sudah tersambung. Langsung pilih <b>Beli Nokos</b>.\n`
      : `Kamu belum menautkan akun.\n\n` +
        row("🔑", "Punya kode akun dari web? Tekan <b>Login</b>.") +
        row("✨", "Belum punya? <b>Buat Akun Gratis</b> — saldonya langsung bisa dipakai di web juga.")) +
    `\n` +
    foot(`⚡ ${aktif} server aktif · 🕐 24 jam · 🔁 Refund otomatis`);

  await memuat.stop();
  await deleteMessage(chatId, memuat.messageId);

  return sendLocalPhoto(chatId, BANNER, caption, menuKeyboard(settings, user, { forOwner: isShopBotOwner(chatId) }));
}

export async function showHome(chatId, messageId = null, flash = "") {
  const settings = await getSettings();
  const session = await getSession(chatId);
  const user = await linkedUser(session);
  await clearStep(chatId);

  const aktif = OTP_SERVERS.filter((x) => serverDisplay(settings, x.key).enabled).length;

  const text =
    head("🦅", "ARTA PEDIA ID", "Nokos termurah dan fast") +
    (flash ? `\n${flash}\n` : "") +
    `\n` +
    (user
      ? `💰  <b>${rupiah(user.balance)}</b>\n\n` +
        panel([
          panelRow("Kode akun", user.token),
          panelRow("Server aktif", String(aktif)),
          panelRow("Layanan", "24 jam nonstop")
        ]) +
        `\nSaldo ini sama persis dengan yang di web. Dipakai di mana pun, potongannya satu.\n`
      : `Kamu belum menautkan akun.\n\n` +
        row("🔑", "Punya kode akun dari web? Tekan <b>Login</b>.") +
        row("✨", "Belum punya? <b>Buat Akun Gratis</b>.")) +
    `\n` +
    foot(`⚡ ${aktif} server aktif · 🕐 24 jam · 🔁 Refund otomatis`);

  const keyboard = menuKeyboard(settings, user, { forOwner: isShopBotOwner(chatId) });

  return messageId ? editMessage(chatId, messageId, text, keyboard) : sendMessage(chatId, text, keyboard);
}

// ─────────────────────────── AKUN ───────────────────────────

export async function askLogin(chatId, messageId) {
  await setSession(chatId, { step: "login" });
  return editMessage(
    chatId,
    messageId,
    `🔑  <b>LOGIN KODE AKUN</b>\n${RULE}\n\n` +
      `Kirim kode akun kamu di chat ini.\n\n` +
      `Bentuknya seperti: <code>AP-1A2B-3C4D-5E6F</code>\n` +
      `Bisa dilihat di web pada menu <b>Beranda → Kode akun</b>.\n\n` +
      `Setelah tertaut, saldo di web dan di bot jadi satu.`,
    [
      [{ text: "✨ Belum punya — Buat Akun Gratis", callback_data: "reg" }],
      [{ text: "← Batal", callback_data: "home" }]
    ]
  );
}

export async function doLogin(chatId, code) {
  const users = await usersCol();
  const token = String(code || "").trim().toUpperCase();
  const user = await users.findOne({ token });
  if (!user) {
    return sendMessage(
      chatId,
      `❌ Kode akun <code>${esc(token)}</code> tidak ditemukan.\n\nCek lagi, atau buat akun baru.`,
      [
        [{ text: "🔁 Coba Lagi", callback_data: "login" }],
        [{ text: "✨ Buat Akun Baru", callback_data: "reg" }],
        [{ text: "← Menu", callback_data: "home" }]
      ]
    );
  }

  await setSession(chatId, { token: user.token });
  await users.updateOne({ token: user.token }, { $set: { telegramChatId: String(chatId) } });
  await clearStep(chatId);
  return showHome(chatId, null, `✅ Akun tertaut. Saldo kamu: <b>${rupiah(user.balance)}</b>`);
}

export async function doRegister(chatId, messageId, fromUser) {
  const session = await getSession(chatId);
  if (session?.token) return showHome(chatId, messageId, "Kamu sudah punya akun tertaut.");

  const users = await usersCol();
  let token = null;
  for (let i = 0; i < 5; i++) {
    const candidate = generateUserToken();
    if (!(await users.findOne({ token: candidate }))) {
      token = candidate;
      break;
    }
  }
  if (!token) return editMessage(chatId, messageId, "Gagal membuat akun, coba lagi sebentar.", [[{ text: "← Menu", callback_data: "home" }]]);

  const createdAt = new Date();
  await users.insertOne({
    token,
    balance: 0,
    referredBy: null,
    referralCount: 0,
    referralEarnings: 0,
    referralBonusGiven: false,
    points: 0,
    totalSpent: 0,
    cashbackTotal: 0,
    createdAt,
    // Dicatat supaya notifikasi & dukungan tahu user ini datang dari bot.
    source: "telegram",
    telegramChatId: String(chatId),
    telegramUsername: fromUser?.username || null
  });
  await setSession(chatId, { token });

  const userCount = await users.countDocuments();
  const notif = newUserNotif({ token, referredBy: null, userCount });
  umumkan({ jenis: "user_baru", admin: notif, publik: notif });

  const settings = await getSettings();
  const web = siteUrl(settings);
  return editMessage(
    chatId,
    messageId,
    `✨  <b>AKUN BERHASIL DIBUAT!</b>\n${RULE}\n\n` +
      `👤 Kode akun kamu:\n<code>${esc(token)}</code>\n\n` +
      `⚠️ <b>Simpan kode ini baik-baik.</b> Kode ini satu-satunya kunci akunmu — ` +
      `siapa pun yang memilikinya bisa memakai saldomu.\n\n` +
      (web ? `Pakai kode yang sama untuk masuk di web: ${esc(web)}\n\n` : "") +
      `Saldo awal Rp0. Isi saldo dulu sebelum beli nokos.`,
    [
      [{ text: "💰 Isi Saldo", callback_data: "dep" }],
      [{ text: "← Menu", callback_data: "home" }]
    ]
  );
}

export async function showAccount(chatId, messageId) {
  const settings = await getSettings();
  const session = await getSession(chatId);
  const user = await linkedUser(session);
  if (!user) return showHome(chatId, messageId, "Akun belum tertaut.");

  const orders = await otpOrdersCol();
  const total = await orders.countDocuments({ token: user.token });
  const sukses = await orders.countDocuments({ token: user.token, status: "done" });
  const web = siteUrl(settings);

  const keyboard = [
    [{ text: "🔄 Ganti Akun", callback_data: "login" }],
    [{ text: "🔓 Lepas Tautan", callback_data: "logout" }],
    [{ text: "← Menu", callback_data: "home" }]
  ];
  if (web) keyboard.splice(2, 0, [{ text: "🌐 Buka di Web", url: web }]);

  return editMessage(
    chatId,
    messageId,
    head("👤", "AKUN KAMU") +
      `\n💰  <b>${rupiah(user.balance)}</b>\n\n` +
      panel([
        panelRow("Kode akun", user.token),
        PANEL_SEP,
        panelRow("Total pesanan", String(total)),
        panelRow("Berhasil", String(sukses)),
        panelRow("Tingkat sukses", total ? `${Math.round((sukses / total) * 100)}%` : "—")
      ]) +
      (total ? `${bar(sukses, total, 14)}\n` : "") +
      `\n` +
      foot("Kode akun ini juga dipakai untuk masuk di web. Saldonya satu, tidak terpisah."),
    keyboard
  );
}

export async function doLogout(chatId, messageId) {
  await setSession(chatId, { token: null });
  return showHome(chatId, messageId, "🔓 Tautan akun dilepas.");
}

// ─────────────────────────── INFORMASI ───────────────────────────

export async function showInfo(chatId, messageId) {
  const settings = await getSettings();
  const web = siteUrl(settings);
  const keyboard = [[csButton(settings)], [{ text: "← Menu", callback_data: "home" }]];
  if (web) keyboard.unshift([{ text: "🌐 Website", url: web }]);

  return editMessage(
    chatId,
    messageId,
    `ℹ️  <b>INFORMASI ARTA PEDIA</b>\n${RULE}\n\n` +
      `<b>Cara pakai</b>\n` +
      `1. Isi saldo lewat menu Deposit\n` +
      `2. Pilih Beli Nokos → server → aplikasi → negara\n` +
      `3. Nomor langsung muncul, kode OTP masuk otomatis\n\n` +
      `<b>Refund</b>\n` +
      `Kalau OTP tidak masuk sampai masa aktif habis, saldo kembali otomatis. ` +
      `Nomor yang sudah menerima OTP tidak bisa direfund.\n\n` +
      `<b>Ketentuan</b>\n` +
      `Nomor virtual dipakai sekali untuk verifikasi. Jangan dipakai untuk akun ` +
      `penting jangka panjang — nomor bisa dipakai ulang orang lain setelah masa aktif habis.\n\n` +
      `<b>Saldo</b>\n` +
      `Saldo di bot dan di web adalah saldo yang sama. Beli di mana pun, potongannya satu.`,
    keyboard
  );
}

// ─────────────────────── STATUS SERVER & PANDUAN ───────────────────────

// Daftar server apa adanya: yang mati pun ditampilkan, berikut pesan yang
// diatur admin. Di menu Beli Nokos server mati memang disembunyikan supaya
// tidak bisa dipilih — tapi user yang bertanya "kok servernya hilang?" berhak
// tahu jawabannya di satu layar, bukan mengira botnya rusak.
export async function showServerStatus(chatId, messageId) {
  const settings = await getSettings();

  const baris = OTP_SERVERS.map((sv) => {
    const d = serverDisplay(settings, sv.key);
    const kepala = `${d.enabled ? "🟢" : "🔴"} <b>${esc(d.name)}</b>${d.badge ? `  ·  <i>${esc(d.badge)}</i>` : ""}`;
    const isi = d.enabled
      ? d.desc
        ? `   ${esc(d.desc)}`
        : "   Siap dipakai."
      : `   ${esc(serverOfflineMessage(settings, sv.key))}`;
    return `${kepala}\n${isi}`;
  }).join("\n\n");

  const aktif = OTP_SERVERS.filter((sv) => serverDisplay(settings, sv.key).enabled).length;

  return editMessage(
    chatId,
    messageId,
    `📊  <b>STATUS SERVER</b>\n${RULE}\n\n` +
      `${baris}\n\n` +
      `${RULE}\n` +
      `${aktif} dari ${OTP_SERVERS.length} server sedang menyala.\n` +
      `Hanya server hijau yang muncul di menu Beli Nokos.`,
    [
      [{ text: "🛒 Beli Nokos", callback_data: "buy" }],
      [{ text: "🔄 Muat Ulang", callback_data: "srvstat" }],
      [{ text: "← Menu", callback_data: "home" }]
    ]
  );
}

export async function showHowTo(chatId, messageId) {
  const settings = await getSettings();

  return editMessage(
    chatId,
    messageId,
    `❓  <b>CARA PAKAI — 4 LANGKAH</b>\n${RULE}\n\n` +
      `<b>1️⃣  Siapkan akun</b>\n` +
      `Tekan <b>Buat Akun Gratis</b>, atau <b>Login Kode Akun</b> kalau sudah punya kode dari web. ` +
      `Satu akun dipakai di bot dan di web sekaligus.\n\n` +
      `<b>2️⃣  Isi saldo</b>\n` +
      `Menu <b>Deposit</b> → pilih metode → pilih nominal → scan QRIS. ` +
      `Saldo masuk sendiri dalam hitungan detik, tidak perlu konfirmasi ke admin.\n\n` +
      `<b>3️⃣  Beli nomor</b>\n` +
      `Menu <b>Beli Nokos</b> → pilih server → cari aplikasi → pilih negara → pilih harga. ` +
      `Nomornya langsung muncul di layar.\n\n` +
      `<b>4️⃣  Tunggu OTP</b>\n` +
      `Masukkan nomor itu di aplikasi yang mau diverifikasi. Kodenya dikirim ke chat ini ` +
      `secara otomatis begitu masuk — tidak perlu menekan apa pun.\n\n` +
      `${RULE}\n` +
      `💡 <b>Kalau OTP tidak masuk</b>\n` +
      `Saldo kembali sendiri saat masa aktif nomor habis. Tidak perlu lapor, tidak perlu menunggu admin.`,
    [
      [{ text: "✨ Mulai — Buat Akun", callback_data: "reg" }],
      [
        { text: "💳 Deposit", callback_data: "dep" },
        { text: "🛒 Beli Nokos", callback_data: "buy" }
      ],
      [csButton(settings)],
      [{ text: "← Menu", callback_data: "home" }]
    ]
  );
}

// ─────────────────────────── BELI NOKOS ───────────────────────────

// Hanya server yang menyala yang ditampilkan — yang dimatikan admin tidak
// muncul sama sekali di bot.
export async function showServers(chatId, messageId) {
  const settings = await getSettings();
  const session = await getSession(chatId);
  const user = await linkedUser(session);

  const rows = [];
  for (const s of OTP_SERVERS) {
    const d = serverDisplay(settings, s.key);
    if (!d.enabled) continue;
    rows.push([{ text: `${d.badge ? `[${d.badge}] ` : ""}${d.name}`, callback_data: `srv:${s.key}` }]);
  }

  if (!rows.length) {
    return editMessage(
      chatId,
      messageId,
      `📱  <b>BELI NOKOS</b>\n${RULE}\n\nSemua server sedang ditutup sementara. Coba lagi nanti ya.`,
      [[csButton(settings)], [{ text: "← Menu", callback_data: "home" }]]
    );
  }

  rows.push([{ text: "← Menu", callback_data: "home" }]);
  return editMessage(
    chatId,
    messageId,
    `📱  <b>BELI NOKOS</b>\n${RULE}\n\n` +
      (user ? `💰 Saldo kamu: <b>${rupiah(user.balance)}</b>\n\n` : `⚠️ Akun belum tertaut — login dulu sebelum order.\n\n`) +
      `Pilih server dulu:`,
    rows
  );
}

export async function chooseServer(chatId, messageId, serverKey) {
  const settings = await getSettings();
  const d = serverDisplay(settings, serverKey);
  if (!d.enabled) return showServers(chatId, messageId);

  sendChatAction(chatId, "typing");
  const memuat = await startLoading(chatId, `📡 <b>Menghubungi ${esc(d.name)}…</b>\nMengambil daftar aplikasi`, messageId);

  let services;
  try {
    services = await listServices(serverKey);
  } catch (err) {
    await memuat.stop();
    return editMessage(
      chatId,
      messageId,
      `❌ Gagal memuat aplikasi dari ${esc(d.name)}.\n\n<code>${esc(err?.message || "gagal")}</code>`,
      [
        [{ text: "🔄 Coba Lagi", callback_data: `srv:${serverKey}` }],
        [{ text: "← Pilih Server Lain", callback_data: "buy" }]
      ]
    );
  }
  await memuat.stop();

  const slim = services.map((s) => ({ c: String(s.service_code), n: String(s.service_name) }));
  await setSession(chatId, { server: serverKey, services: slim, svPage: 0, query: "" });
  return listServicesPage(chatId, messageId, 0);
}

export async function listServicesPage(chatId, messageId, page) {
  const settings = await getSettings();
  const session = await getSession(chatId);
  const all = session.services || [];
  const q = (session.query || "").toLowerCase();
  const items = q ? all.filter((s) => s.n.toLowerCase().includes(q)) : all;

  const pages = Math.max(1, Math.ceil(items.length / PER_PAGE));
  const p = Math.min(Math.max(0, page), pages - 1);
  const slice = items.slice(p * PER_PAGE, p * PER_PAGE + PER_PAGE);

  const rows = slice.map((s) => [{ text: s.n, callback_data: `svc:${all.indexOf(s)}` }]);
  const nav = [];
  if (p > 0) nav.push({ text: "« Sebelumnya", callback_data: `svp:${p - 1}` });
  if (p < pages - 1) nav.push({ text: "Berikutnya »", callback_data: `svp:${p + 1}` });
  if (nav.length) rows.push(nav);

  // Pintasan aplikasi yang paling sering dicari. Daftar tiap provider bisa
  // ratusan baris, dan enam tombol ini menghapus langkah mengetik untuk
  // sebagian besar pembeli.
  if (!q) {
    rows.push(POPULAR.slice(0, 3).map((x) => ({ text: x.label, callback_data: `svf:${x.q}` })));
    rows.push(POPULAR.slice(3).map((x) => ({ text: x.label, callback_data: `svf:${x.q}` })));
  }

  rows.push([
    { text: "🔍 Cari Aplikasi", callback_data: "svq" },
    ...(q ? [{ text: "✖️ Hapus Filter", callback_data: "svf:" }] : [])
  ]);
  rows.push([{ text: "← Ganti Server", callback_data: "buy" }]);

  await setSession(chatId, { svPage: p });
  const d = serverDisplay(settings, session.server);
  return editMessage(
    chatId,
    messageId,
    `📱  <b>${esc(d.name)}</b>\n${RULE}\n\n` +
      (q ? `🔍 Pencarian: <b>${esc(session.query)}</b>\n` : "") +
      `Pilih aplikasi (${items.length} tersedia) — halaman ${p + 1}/${pages}:`,
    rows
  );
}

// Pintasan aplikasi populer: mengisi kotak pencarian tanpa mengetik.
// Kata kunci kosong berarti menghapus filter.
export async function filterServices(chatId, messageId, keyword) {
  await setSession(chatId, { query: keyword || "", svPage: 0, step: null });
  return listServicesPage(chatId, messageId, 0);
}

export async function askServiceQuery(chatId, messageId) {
  await setSession(chatId, { step: "svq" });
  return editMessage(
    chatId,
    messageId,
    `🔍  <b>CARI APLIKASI</b>\n${RULE}\n\nKetik nama aplikasinya, mis. <code>whatsapp</code>`,
    [[{ text: "← Batal", callback_data: "svp:0" }]]
  );
}

export async function chooseService(chatId, messageId, idx) {
  const session = await getSession(chatId);
  const svc = (session.services || [])[idx];
  if (!svc) return listServicesPage(chatId, messageId, 0);

  await editMessage(chatId, messageId, `⏳ Memuat negara & harga untuk <b>${esc(svc.n)}</b>…`);

  const settings = await getSettings();
  let countries;
  try {
    countries = await listCountries(settings, session.server, svc.c);
  } catch (err) {
    return editMessage(
      chatId,
      messageId,
      `❌ Gagal memuat harga.\n\n<code>${esc(err?.message || "gagal")}</code>`,
      [[{ text: "← Pilih Aplikasi Lain", callback_data: `svp:${session.svPage || 0}` }]]
    );
  }

  // Disimpan ramping: tombol cukup mengirim nomor urut, bukan seluruh data.
  const slim = countries.slice(0, 60).map((c) => ({
    n: String(c.name || "-"),
    f: c.flag || null,
    p: (c.pricelist || []).slice(0, 8).map((x) => ({
      id: String(x.provider_id),
      nm: String(x.provider_name || "Paket"),
      s: x.sell_price,
      st: x.stock ?? null,
      cid: x.country_id ?? null,
      pi: x.providerIndex ?? null
    }))
  }));

  await setSession(chatId, { service: svc, countries: slim, coPage: 0 });
  return listCountriesPage(chatId, messageId, 0);
}

export async function listCountriesPage(chatId, messageId, page) {
  const session = await getSession(chatId);
  const items = session.countries || [];
  if (!items.length) {
    return editMessage(chatId, messageId, "Tidak ada negara yang tersedia untuk aplikasi ini.", [
      [{ text: "← Pilih Aplikasi Lain", callback_data: `svp:${session.svPage || 0}` }]
    ]);
  }

  const pages = Math.max(1, Math.ceil(items.length / PER_PAGE));
  const p = Math.min(Math.max(0, page), pages - 1);
  const slice = items.slice(p * PER_PAGE, p * PER_PAGE + PER_PAGE);

  const rows = slice.map((c) => {
    const i = items.indexOf(c);
    const cheapest = c.p.length ? Math.min(...c.p.map((x) => x.s)) : 0;
    return [{ text: `${c.f ? `${c.f} ` : ""}${c.n} · ${rupiah(cheapest)}`, callback_data: `cou:${i}` }];
  });
  const nav = [];
  if (p > 0) nav.push({ text: "« Sebelumnya", callback_data: `cop:${p - 1}` });
  if (p < pages - 1) nav.push({ text: "Berikutnya »", callback_data: `cop:${p + 1}` });
  if (nav.length) rows.push(nav);
  rows.push([{ text: "← Pilih Aplikasi Lain", callback_data: `svp:${session.svPage || 0}` }]);

  await setSession(chatId, { coPage: p });
  return editMessage(
    chatId,
    messageId,
    `🌍  <b>${esc(session.service?.n || "-")}</b>\n${RULE}\n\n` +
      `Pilih negara — halaman ${p + 1}/${pages}:\n` +
      `<i>Harga yang tampil adalah harga termurah di negara itu.</i>`,
    rows
  );
}

export async function chooseCountry(chatId, messageId, idx) {
  const session = await getSession(chatId);
  const c = (session.countries || [])[idx];
  if (!c) return listCountriesPage(chatId, messageId, 0);

  const rows = c.p.map((x, i) => [
    {
      text: `${rupiah(x.s)} · ${x.nm}${x.st != null ? ` · stok ${x.st}` : ""}`,
      callback_data: `prc:${idx}:${i}`
    }
  ]);
  rows.push([{ text: "← Pilih Negara Lain", callback_data: `cop:${session.coPage || 0}` }]);

  return editMessage(
    chatId,
    messageId,
    `${c.f ? `${c.f} ` : ""}<b>${esc(c.n)}</b> · ${esc(session.service?.n || "-")}\n` +
      `${RULE}\n\nPilih paket:`,
    rows
  );
}

export async function confirmOrder(chatId, messageId, coIdx, prIdx) {
  const session = await getSession(chatId);
  const settings = await getSettings();
  const c = (session.countries || [])[coIdx];
  const price = c?.p?.[prIdx];
  if (!c || !price) return listCountriesPage(chatId, messageId, 0);

  const user = await linkedUser(session);
  if (!user) {
    return editMessage(
      chatId,
      messageId,
      `🔑  <b>LOGIN DULU</b>\n${RULE}\n\nUntuk order, akunmu harus tertaut dulu.`,
      [
        [{ text: "🔑 Login Kode Akun", callback_data: "login" }],
        [{ text: "✨ Buat Akun Baru", callback_data: "reg" }],
        [{ text: "← Menu", callback_data: "home" }]
      ]
    );
  }

  const kurang = user.balance < price.s;
  await setSession(chatId, { pending: { coIdx, prIdx } });

  const d = serverDisplay(settings, session.server);
  return editMessage(
    chatId,
    messageId,
    head("🧾", "KONFIRMASI PESANAN", `${esc(session.service?.n || "-")} · ${c.f ? `${c.f} ` : ""}${esc(c.n)}`) +
      `\n💵  <b>${rupiah(price.s)}</b>\n\n` +
      panel([
        panelRow("Server", d.name),
        panelRow("Paket", price.nm),
        panelRow("Harga", rupiah(price.s)),
        PANEL_SEP,
        panelRow("Saldo sekarang", rupiah(user.balance)),
        kurang ? panelRow("Kurang", rupiah(price.s - user.balance)) : panelRow("Sisa setelah beli", rupiah(user.balance - price.s))
      ]) +
      (kurang
        ? `\n⚠️ <b>Saldomu kurang ${rupiah(price.s - user.balance)}.</b> Isi saldo dulu ya.`
        : `\n` + foot("Saldo dipotong saat nomor keluar. Kalau nomornya gagal, saldonya tidak jadi terpotong.")),
    kurang
      ? [
          [{ text: "💰 Isi Saldo", callback_data: "dep" }],
          [{ text: "← Kembali", callback_data: `cou:${coIdx}` }]
        ]
      : [
          [{ text: "✅ Pesan Sekarang", callback_data: "ord" }],
          [{ text: "← Kembali", callback_data: `cou:${coIdx}` }]
        ]
  );
}

export async function doOrder(chatId, messageId) {
  const session = await getSession(chatId);
  const settings = await getSettings();
  const { coIdx, prIdx } = session.pending || {};
  const c = (session.countries || [])[coIdx];
  const price = c?.p?.[prIdx];
  const user = await linkedUser(session);
  if (!c || !price || !user) return showHome(chatId, messageId, "Pesanan kedaluwarsa, ulangi ya.");

  sendChatAction(chatId, "typing");
  const memuat = await startLoading(chatId, "🛒 <b>Memproses pesanan…</b>\nMengambil nomor dari server", messageId);

  const result = await placeOtpOrder({
    token: user.token,
    server: session.server,
    serviceId: session.service?.c,
    serviceName: session.service?.n,
    countryName: c.n,
    countryId: price.cid,
    providerId: price.id,
    providerIndex: price.pi,
    numberId: price.cid == null ? String(price.id).split(":")[0] : undefined,
    operatorId: "any"
  });

  // Ditunggu sampai selesai: satu frame yang terlanjur terbang bisa menimpa
  // nomor dan kode OTP-nya kalau tidak.
  await memuat.stop();

  if (!result.ok) {
    return editMessage(
      chatId,
      messageId,
      `❌  <b>PESANAN GAGAL</b>\n${RULE}\n\n${esc(result.error)}`,
      [
        [{ text: "🔁 Coba Lagi", callback_data: `cou:${coIdx}` }],
        [csButton(settings)],
        [{ text: "← Menu", callback_data: "home" }]
      ]
    );
  }

  await setSession(chatId, { lastOrder: result.order.orderId });
  return editMessage(
    chatId,
    messageId,
    orderText(result.order, session.service?.n, c.n, "Menunggu SMS"),
    [
      [{ text: "🔄 Cek Kode OTP", callback_data: `st:${result.order.orderId}` }],
      [cancelButton(result.order.orderId, Date.now())],
      [{ text: "🧾 Pesanan Saya", callback_data: "orders" }],
      [{ text: "← Menu", callback_data: "home" }]
    ]
  );
}

function orderText(order, serviceName, countryName, statusLabel, otp = null) {
  return (
    (otp
      ? head("🎉", "KODE OTP MASUK", `${esc(serviceName || "-")} · ${esc(countryName || "-")}`)
      : head("✅", "NOMOR DIDAPAT", `${esc(serviceName || "-")} · ${esc(countryName || "-")}`)) +
    `\n` +
    (otp
      // Kode ditaruh paling atas dan berdiri sendiri: inilah satu-satunya hal
      // yang dicari user saat membuka layar ini.
      ? `<code>${esc(otp)}</code>\n` +
        `<i>Ketuk kode untuk menyalin.</i>\n\n`
      : "") +
    // Nomornya berdiri sendiri di luar panel supaya bisa diketuk untuk disalin.
    // Di dalam blok monospace, ketukan menyalin seluruh bloknya.
    `☎️  <code>${esc(order.phoneNumber)}</code>\n\n` +
    panel([
      panelRow("Harga", rupiah(order.price)),
      otp ? null : panelRow("Status", statusLabel),
      panelRow("Saldo", rupiah(order.balance))
    ]) +
    // ID-nya di luar panel: di dalam blok monospace, ketukan menyalin SELURUH
    // blok, dan ID yang kepanjangan ikut dipotong supaya panelnya tetap lurus.
    // ID yang terpotong tidak ada gunanya dikirim ke CS.
    `\n🆔  <code>${esc(order.orderId)}</code>\n\n` +
    foot(otp ? "Kode di atas hanya berlaku sekali. Jangan dibagikan ke siapa pun." : "Ketuk nomor untuk menyalin, lalu pakai di aplikasi tujuan.")
  );
}

// Label tombol ikut menghitung sisa masa tunggu. Tombol yang terlihat siap
// ditekan padahal pasti ditolak hanya membuat user menekannya berkali-kali;
// menuliskan sisa detiknya di label jauh lebih jujur.
function cancelButton(orderId, createdAt) {
  const sisa = CANCEL_COOLDOWN_MS - (Date.now() - new Date(createdAt).getTime());
  return sisa > 0
    ? { text: `⏳ Batal (tunggu ${Math.ceil(sisa / 1000)} dtk)`, callback_data: `ocx:${orderId}` }
    : { text: "❌ Batalkan & Refund", callback_data: `ocx:${orderId}` };
}

// Langkah konfirmasi. Membatalkan memang mengembalikan saldo, tapi nomornya
// hilang — dan kalau OTP-nya menyusul beberapa detik kemudian, nomor itu tidak
// bisa diambil lagi. Satu ketukan salah terlalu mahal untuk tanpa konfirmasi.
export async function askCancelOrder(chatId, messageId, orderId) {
  const settings = await getSettings();
  const orders = await otpOrdersCol();
  const order = await orders.findOne({ orderId });
  if (!order) return showHome(chatId, messageId, "Pesanan tidak ditemukan.");

  if (order.otpCode || order.status === "done") {
    return checkStatus(chatId, messageId, orderId);
  }

  const sisa = CANCEL_COOLDOWN_MS - (Date.now() - new Date(order.createdAt).getTime());
  if (sisa > 0) {
    return editMessage(
      chatId,
      messageId,
      head("⏳", "BELUM BISA DIBATALKAN") +
        `\n` +
        row("🕐", `Sisa tunggu · <b>${Math.ceil(sisa / 1000)} detik</b>`) +
        `\nPesanan baru bisa dibatalkan 3 menit setelah dibeli. Jeda ini dari sisi ` +
        `penyedia nomor — seringnya OTP justru masuk di menit-menit ini.`,
      [
        [{ text: "🔄 Cek Kode OTP", callback_data: `st:${orderId}` }],
        [{ text: "← Kembali", callback_data: `st:${orderId}` }]
      ]
    );
  }

  return editMessage(
    chatId,
    messageId,
    head("❌", "BATALKAN PESANAN?", esc(order.serviceName || "-")) +
      `\n☎️  <code>${esc(order.phoneNumber)}</code>\n\n` +
      panel([
        panelRow("Layanan", order.serviceName || "-"),
        panelRow("Saldo kembali", rupiah(order.price))
      ]) +
      `\n${RULE_THIN}\n` +
      `Saldo kembali penuh, tapi <b>nomor ini hilang</b> dan tidak bisa diambil lagi. ` +
      `Kalau OTP-nya menyusul setelah dibatalkan, kodenya ikut hilang.`,
    [
      [{ text: "✅ Ya, Batalkan", callback_data: `ocy:${orderId}` }],
      [{ text: "↩️ Tidak, Lanjut Tunggu", callback_data: `st:${orderId}` }],
      [csButton(settings)]
    ]
  );
}

export async function doCancelOrder(chatId, messageId, orderId) {
  const settings = await getSettings();
  const session = await getSession(chatId);
  const user = await linkedUser(session);
  if (!user) return showHome(chatId, messageId, "Akun belum tertaut.");

  const memuat = await startLoading(chatId, "❌ <b>Membatalkan pesanan…</b>\nMenghubungi server nomor", messageId);
  const r = await cancelOtpOrder({ token: user.token, orderId });
  await memuat.stop();

  // Dibatalkan tepat saat OTP-nya masuk: kodenya sudah jadi milik user, jadi
  // yang ditampilkan kodenya — bukan pesan gagal membatalkan.
  if (r.otpCode) {
    return editMessage(
      chatId,
      messageId,
      `🎉  <b>JUSTRU KODENYA BARU MASUK!</b>\n${RULE}\n\n` +
        `🔐 <b>KODE OTP</b>\n<code>${esc(r.otpCode)}</code>\n\n` +
        `<i>Ketuk kode untuk menyalin.</i>\n\n` +
        `Pembatalannya dihentikan — kode ini sudah jadi milikmu.`,
      [
        [{ text: "🧾 Pesanan Saya", callback_data: "orders" }],
        [{ text: "← Menu", callback_data: "home" }]
      ]
    );
  }

  if (!r.ok) {
    return editMessage(
      chatId,
      messageId,
      `⚠️  <b>GAGAL MEMBATALKAN</b>\n${RULE}\n\n${esc(r.error)}`,
      [
        [{ text: "🔄 Cek Status Pesanan", callback_data: `st:${orderId}` }],
        [csButton(settings)],
        [{ text: "← Menu", callback_data: "home" }]
      ]
    );
  }

  const segar = await linkedUser(session);
  return editMessage(
    chatId,
    messageId,
    head("✅", "PESANAN DIBATALKAN") +
      `\n💰  <b>${rupiah(segar?.balance)}</b>\n\n` +
      panel([
        r.refundAmount ? panelRow("Saldo kembali", rupiah(r.refundAmount)) : null,
        panelRow("Saldo sekarang", rupiah(segar?.balance))
      ]) +
      `\n🆔  <code>${esc(orderId)}</code>\n` +
      (r.message ? `\n${foot(esc(r.message))}` : ""),
    [
      [{ text: "🛒 Beli Lagi", callback_data: "buy" }],
      [{ text: "🧾 Pesanan Saya", callback_data: "orders" }],
      [{ text: "← Menu", callback_data: "home" }]
    ]
  );
}

export async function checkStatus(chatId, messageId, orderId) {
  const settings = await getSettings();
  const orders = await otpOrdersCol();
  const order = await orders.findOne({ orderId });
  if (!order) return showHome(chatId, messageId, "Pesanan tidak ditemukan.");

  let r;
  try {
    r = await reconcileOtpOrder(order);
  } catch {
    return answerCallback(null);
  }

  const label =
    r.resolvedStatus === "done"
      ? "Selesai"
      : r.resolvedStatus === "pending"
      ? "Menunggu SMS"
      : r.resolvedStatus;

  const view = {
    phoneNumber: order.phoneNumber,
    price: order.price,
    orderId: order.orderId,
    balance: r.newBalance ?? (await linkedUser(await getSession(chatId)))?.balance ?? 0
  };

  const rows = [];
  if (!r.otpCode) {
    rows.push([{ text: "🔄 Cek Lagi", callback_data: `st:${orderId}` }]);
    // Hanya selama belum ada OTP. Sesudah kodenya masuk pesanan memang tidak
    // bisa dibatalkan, jadi tombolnya tidak boleh ada di sana sama sekali.
    if (!order.refunded && order.status !== "canceled") {
      rows.push([cancelButton(orderId, order.createdAt)]);
    }
  }
  rows.push([{ text: "🧾 Pesanan Saya", callback_data: "orders" }]);
  rows.push([csButton(settings)]);
  rows.push([{ text: "← Menu", callback_data: "home" }]);

  return editMessage(
    chatId,
    messageId,
    orderText(view, order.serviceName, order.countryName, label, r.otpCode),
    rows
  );
}

export async function showOrders(chatId, messageId) {
  const settings = await getSettings();
  const session = await getSession(chatId);
  const user = await linkedUser(session);
  if (!user) return showHome(chatId, messageId, "Akun belum tertaut.");

  const orders = await otpOrdersCol();
  const list = await orders.find({ token: user.token }).sort({ createdAt: -1 }).limit(8).toArray();

  if (!list.length) {
    return editMessage(chatId, messageId, `🧾  <b>PESANAN SAYA</b>\n${RULE}\n\nBelum ada pesanan.`, [
      [{ text: "📱 Beli Nokos", callback_data: "buy" }],
      [{ text: "← Menu", callback_data: "home" }]
    ]);
  }

  const icon = (s) => (s === "done" ? "✅" : s === "pending" ? "⏳" : "❌");
  const body = list
    .map(
      (o) =>
        `${icon(o.status)} <b>${esc(o.serviceName)}</b> · ${esc(o.countryName)}\n` +
        `   <code>${esc(o.phoneNumber)}</code> · ${rupiah(o.price)}` +
        (o.otpCode ? `\n   🔐 <code>${esc(o.otpCode)}</code>` : "")
    )
    .join("\n\n");

  const rows = list
    .filter((o) => o.status === "pending")
    .slice(0, 3)
    .map((o) => [{ text: `🔄 Cek ${o.serviceName}`, callback_data: `st:${o.orderId}` }]);
  rows.push([{ text: "📱 Beli Lagi", callback_data: "buy" }]);
  rows.push([{ text: "← Menu", callback_data: "home" }]);

  return editMessage(
    chatId,
    messageId,
    `🧾  <b>PESANAN SAYA</b>\n${RULE}\n\n${body}\n\n💰 Saldo ╸ <b>${rupiah(user.balance)}</b>`,
    rows
  );
}

// ─────────────────────────── DEPOSIT ───────────────────────────

export async function showDepositMethods(chatId, messageId) {
  const settings = await getSettings();
  const session = await getSession(chatId);
  const user = await linkedUser(session);

  if (!user) {
    return editMessage(
      chatId,
      messageId,
      `🔑  <b>LOGIN DULU</b>\n${RULE}\n\nSaldo menempel di akun, jadi tautkan akunmu dulu ya.`,
      [
        [{ text: "🔑 Login Kode Akun", callback_data: "login" }],
        [{ text: "✨ Buat Akun Baru", callback_data: "reg" }],
        [{ text: "← Menu", callback_data: "home" }]
      ]
    );
  }

  const rows = [];
  for (const key of PROVIDER_KEYS) {
    if (!settings.depositProviders?.[key]) continue;
    // Metode yang menyala tapi belum siap tetap disembunyikan: tombol yang
    // pasti menjawab "belum dikonfigurasi" lebih buruk daripada tidak ada.
    if (key === "atlantic" && !atlanticConfigured()) continue;
    if (key === MANUAL_DEPOSIT_KEY && !manualDepositReady(settings)) continue;
    const d = depositDisplay(settings, key);
    // QRIS manual punya jam buka karena yang mengeceknya manusia. Di luar jam
    // itu tombolnya tetap tampak tapi diberi tanda TUTUP, bukan dihilangkan:
    // orang perlu tahu metodenya ada dan kapan bisa dipakai.
    const tutup = key === MANUAL_DEPOSIT_KEY && !manualDepositHours(settings).open;
    rows.push([
      {
        text: `${tutup ? "🔒 " : ""}${d.badge ? `[${d.badge}] ` : ""}${d.name}${tutup ? " — TUTUP" : ""}`,
        callback_data: `dpm:${key}`
      }
    ]);
  }

  if (!rows.length) {
    return editMessage(chatId, messageId, `💰 <b>Deposit</b>\n\nSemua metode sedang ditutup. Coba lagi nanti.`, [
      [csButton(settings)],
      [{ text: "← Menu", callback_data: "home" }]
    ]);
  }

  rows.push([{ text: "← Menu", callback_data: "home" }]);
  return editMessage(
    chatId,
    messageId,
    `💰  <b>DEPOSIT SALDO</b>\n${RULE}\n\n` +
      `💳 Saldo sekarang ╸ <b>${rupiah(user.balance)}</b>\n\n` +
      `Pilih metode pembayaran:`,
    rows
  );
}

export async function askDepositAmount(chatId, messageId, method) {
  const settings = await getSettings();
  const d = depositDisplay(settings, method);

  // Ditahan di depan: membiarkan orang memilih nominal lalu ditolak di langkah
  // terakhir membuang waktunya untuk sesuatu yang sudah pasti gagal.
  if (method === MANUAL_DEPOSIT_KEY) {
    const jam = manualDepositHours(settings);
    if (!jam.open) {
      return editMessage(
        chatId,
        messageId,
        `🔒  <b>${esc(d.name)} SEDANG TUTUP</b>\n${RULE_THIN}\n\n` +
          `Jam layanan ╸ <b>${jam.label}</b>\n` +
          `Buka lagi pukul <b>${String(jam.openHour).padStart(2, "0")}.00 WIB</b>.\n\n` +
          `Metode ini dicek admin satu per satu, jadi ada jam bukanya. Kalau mau isi saldo sekarang juga, pilih QRIS otomatis yang masuk dalam hitungan detik.`,
        [
          [{ text: "⚡ Pilih QRIS Otomatis", callback_data: "dep" }],
          [csButton(settings)],
          [{ text: "← Menu", callback_data: "home" }]
        ]
      );
    }
  }
  const min = Math.max(1, settings.depositMin || 2000);
  const max = Math.max(1, settings.depositMax || 1000000);
  await setSession(chatId, { step: "dep_amount", depMethod: method });

  // Nominal terbanyak dipakai, tiga per baris. Yang di luar batas admin
  // disaring, jadi tidak ada tombol yang pasti ditolak saat ditekan.
  const presets = [5000, 10000, 20000, 25000, 50000, 100000, 200000, 500000].filter(
    (v) => v >= min && v <= max
  );
  const rows = [];
  for (let i = 0; i < presets.length; i += 3) {
    rows.push(presets.slice(i, i + 3).map((v) => ({ text: rupiah(v), callback_data: `dpa:${v}` })));
  }
  rows.push([{ text: "⌨️ Nominal Lain (ketik sendiri)", callback_data: `dpm:${method}` }]);
  rows.push([
    { text: "← Ganti Metode", callback_data: "dep" },
    { text: "🏠 Menu", callback_data: "home" }
  ]);

  return editMessage(
    chatId,
    messageId,
    `💰  <b>${esc(d.name)}</b>\n${RULE}\n\n` +
      (d.desc ? `${esc(d.desc)}\n\n` : "") +
      `Tekan salah satu nominal di bawah, atau <b>ketik angkanya</b> langsung di chat ini.\n\n` +
      `┌ Minimal  ╸ ${rupiah(min)}\n` +
      `└ Maksimal ╸ ${rupiah(max)}\n\n` +
      (d.speed ? `⚡ Perkiraan masuk ╸ ${esc(d.speed)}\n` : "") +
      `🔒 QRIS resmi, dibayar pakai e-wallet atau m-banking apa saja.`,
    rows
  );
}

export async function createDeposit(chatId, amount, messageId = null) {
  const settings = await getSettings();
  const session = await getSession(chatId);
  const user = await linkedUser(session);
  if (!user) return showHome(chatId, messageId, "Akun belum tertaut.");

  const method = session.depMethod || PROVIDER_KEYS[0];

  await clearStep(chatId);
  const loading = await sendMessage(chatId, "⏳ Membuat kode pembayaran…");

  // Memanggil service yang sama dengan web, langsung di proses ini. Dulu bot
  // menembak endpointnya sendiri lewat HTTP, jadi depositnya ikut mati kalau
  // Site URL belum diisi admin — padahal semua yang dibutuhkan ada di sini.
  const created = await createDepositForToken({ token: user.token, amount, provider: method });
  if (!created.ok) {
    return sendMessage(chatId, `❌ ${esc(created.error || "Gagal membuat deposit.")}`, [
      [{ text: "🔁 Coba Lagi", callback_data: "dep" }],
      [csButton(settings)],
      [{ text: "← Menu", callback_data: "home" }]
    ]);
  }
  const data = created.deposit;

  const d = depositDisplay(settings, method);
  const total = Number(data.totalAmount || amount);
  // Nominal yang harus dibayar ditaruh paling atas dan berdiri sendiri.
  // Itu satu-satunya angka yang dipakai orang saat membuka aplikasi banknya;
  // menguburnya di baris keempat membuat mereka harus mencari-cari.
  const manual = method === MANUAL_DEPOSIT_KEY;

  const caption =
    head("💰", "BAYAR DEPOSIT", esc(d.name)) +
    `\n<b>${rupiah(total)}</b>\n` +
    `<i>Scan QRIS di atas, bayar persis segini.</i>\n\n` +
    panel([
      panelRow("Dibayar", rupiah(total)),
      data.adminFee ? panelRow("Biaya admin", rupiah(data.adminFee)) : null,
      panelRow("Saldo masuk", rupiah(amount)),
      manual && data.manualInfo?.accountName ? PANEL_SEP : null,
      manual && data.manualInfo?.accountName ? panelRow("Atas nama", data.manualInfo.accountName) : null,
    ]) +
    `\n🆔  <code>${esc(data.orderId)}</code>\n` +
    `\n${RULE_THIN}\n` +
    `⚠️ Nominalnya harus <b>persis</b> supaya cocok dengan mutasi.\n` +
    // Metode manual TIDAK masuk otomatis. Menjanjikan "hitungan detik" di sini
    // membuat orang menunggu sesuatu yang tidak akan terjadi sendiri, lalu
    // mengira depositnya hilang.
    (manual
      ? `Sesudah bayar, tekan <b>Saya Sudah Bayar</b> — admin mengecek dan saldo masuk setelah disetujui.\n`
      : `Saldo masuk sendiri dalam hitungan detik setelah dibayar.`);

  const rows = manual
    ? [
        [{ text: "✅ Saya Sudah Bayar", callback_data: `dok:${data.orderId}` }],
        [{ text: "🔄 Cek Status", callback_data: `dst:${data.orderId}` }],
        [{ text: "❌ Batalkan", callback_data: `dcx:${data.orderId}` }],
        [{ text: "← Menu", callback_data: "home" }]
      ]
    : [
        [{ text: "🔄 Cek Pembayaran", callback_data: `dst:${data.orderId}` }],
        [{ text: "❌ Batalkan", callback_data: `dcx:${data.orderId}` }],
        [{ text: "← Menu", callback_data: "home" }]
      ];

  if (loading?.result?.message_id) {
    await editMessage(chatId, loading.result.message_id, "✅ Kode pembayaran dibuat, lihat QRIS di bawah 👇");
  }
  if (data.qrImage) return sendQrPhoto(chatId, data.qrImage, caption, rows);
  return sendMessage(chatId, caption, rows);
}

export async function checkDeposit(chatId, messageId, orderId) {
  const settings = await getSettings();
  const session = await getSession(chatId);

  const deposits = await depositsCol();
  const dep = await deposits.findOne({ orderId });
  if (!dep) return showHome(chatId, messageId, "Deposit tidak ditemukan.");

  // syncDeposit satu-satunya jalur yang mengkreditkan saldo — dipakai juga oleh
  // polling web, webhook, dan cron. Dipanggil langsung supaya cek status di bot
  // tidak bergantung pada Site URL.
  try {
    await syncDeposit(dep, { notifyCancel: true });
  } catch (e) {
    console.error("[bot checkDeposit]", e?.message || e);
  }

  const fresh = await deposits.findOne({ orderId });
  const nowUser = await linkedUser(session);
  const st = fresh?.status || "pending";

  if (st === "completed") {
    return sendMessage(
      chatId,
      `🎉  <b>DEPOSIT BERHASIL!</b>\n${RULE}\n\n` +
        `💵 Saldo masuk ╸ <b>${rupiah(fresh.amount)}</b>\n` +
        `💰 Saldo sekarang ╸ <b>${rupiah(nowUser?.balance)}</b>\n\n` +
        `Saldo ini juga langsung bisa dipakai di website.`,
      [
        [{ text: "📱 Beli Nokos", callback_data: "buy" }],
        [{ text: "← Menu", callback_data: "home" }]
      ]
    );
  }

  const label =
    st === "pending" ? "Menunggu pembayaran" : st === "review" ? "Sedang dicek admin" : st;
  return sendMessage(
    chatId,
    `⏳  <b>STATUS DEPOSIT</b>\n${RULE}\n\n` +
      `🆔 <code>${esc(orderId)}</code>\n` +
      `📊 Status ╸ <b>${esc(label)}</b>\n\n` +
      (st === "pending"
        ? `Belum terbayar. Kalau sudah bayar, tunggu sebentar lalu cek lagi.`
        : st === "review"
          ? `Konfirmasimu sudah masuk. Admin sedang mencocokkan pembayaran dengan mutasi QRIS — biasanya 5–15 menit.`
          : ""),
    [
      ...(["pending", "review"].includes(st) ? [[{ text: "🔄 Cek Lagi", callback_data: `dst:${orderId}` }]] : []),
      [csButton(settings)],
      [{ text: "← Menu", callback_data: "home" }]
    ]
  );
}

// "Saya sudah bayar" untuk deposit manual — langkah pertama: MINTA BUKTINYA.
//
// Konfirmasi tanpa bukti cuma klaim yang tidak bisa dicocokkan dengan apa pun,
// dan satu-satunya cara admin memeriksanya adalah membuka mutasi satu per satu
// untuk tiap klaim. Jadi di bot pun buktinya wajib, sama seperti di web:
// yang berbeda cuma caranya — di sini fotonya dikirim sebagai pesan biasa.
export async function confirmDepositManual(chatId, messageId, orderId) {
  const settings = await getSettings();
  const session = await getSession(chatId);
  const user = await linkedUser(session);
  if (!user) return showHome(chatId, messageId, "Akun belum tertaut.");

  const deposits = await depositsCol();
  const dep = await deposits.findOne({ orderId, token: user.token });
  if (!dep) return sendMessage(chatId, "❌ Transaksi tidak ditemukan.", [[{ text: "← Menu", callback_data: "home" }]]);
  if (dep.status !== "pending") {
    // Sudah dikonfirmasi tadi, atau sudah selesai — biar layar status yang
    // menjelaskan keadaannya daripada meminta bukti untuk yang tidak perlu.
    return checkDeposit(chatId, messageId, orderId);
  }

  await setSession(chatId, { step: "dep_proof", proofOrder: orderId });

  return sendMessage(
    chatId,
    `📎  <b>KIRIM BUKTI TRANSFER</b>\n${RULE_THIN}\n\n` +
      `💵  <b>${rupiah(dep.amount)}</b>\n\n` +
      `🆔  <code>${esc(orderId)}</code>\n\n` +
      `Kirim <b>foto bukti transfer</b> kamu ke chat ini sekarang — kirim sebagai foto biasa, bukan berkas.\n\n` +
      foot("Tanpa bukti, admin tidak bisa mencocokkan pembayaranmu dan saldonya tidak akan masuk."),
    [
      [{ text: "✖️ Batal Kirim Bukti", callback_data: `dst:${orderId}` }],
      [csButton(settings)]
    ]
  );
}

// Langkah kedua: fotonya masuk. Dipanggil dari webhook saat session.step
// bernilai "dep_proof".
export async function receiveDepositProof(chatId, photos) {
  const settings = await getSettings();
  const session = await getSession(chatId);
  const user = await linkedUser(session);
  const orderId = session.proofOrder;
  if (!user || !orderId) return showHome(chatId, null, "Sesinya sudah kedaluwarsa, ulangi dari menu deposit.");

  // Telegram mengirim beberapa ukuran dari foto yang sama; yang terakhir paling
  // besar. Diambil yang terbesar supaya nominal di bukti masih terbaca.
  const terbesar = photos[photos.length - 1];
  const hasil = await downloadPhotoAsDataUrl(terbesar?.file_id);

  if (hasil?.tooBig) {
    return sendMessage(chatId, "❌ Fotonya terlalu besar. Kirim ulang dengan ukuran lebih kecil (kirim sebagai foto, bukan berkas).", [
      [{ text: "🔄 Cek Status", callback_data: `dst:${orderId}` }]
    ]);
  }
  if (!hasil?.dataUrl) {
    return sendMessage(chatId, "❌ Gagal mengambil fotonya. Coba kirim ulang sebentar lagi.", [
      [{ text: "🔄 Cek Status", callback_data: `dst:${orderId}` }]
    ]);
  }

  const r = await confirmManualDeposit({
    token: user.token,
    orderId,
    proofImage: hasil.dataUrl,
    note: "Dikonfirmasi lewat bot Telegram"
  });

  await clearStep(chatId);

  if (!r.ok) {
    return sendMessage(chatId, `❌ ${esc(r.error || "Gagal mengirim konfirmasi.")}`, [
      [{ text: "🔄 Cek Status", callback_data: `dst:${orderId}` }],
      [csButton(settings)],
      [{ text: "← Menu", callback_data: "home" }]
    ]);
  }

  if (r.status !== "review") return checkDeposit(chatId, null, orderId);

  return sendMessage(
    chatId,
    head("🔎", "BUKTI TERKIRIM", "Menunggu dicek admin") +
      `\n🆔  <code>${esc(orderId)}</code>\n\n` +
      panel([
        panelRow("Status", "Menunggu dicek"),
        panelRow("Perkiraan", "5-15 menit")
      ]) +
      `\nSaldo masuk otomatis begitu disetujui, dan kamu dikabari di chat ini.\n\n` +
      foot("Tidak perlu mengirim bukti dua kali — yang kedua tidak mempercepat apa pun."),
    [
      [{ text: "🔄 Cek Status", callback_data: `dst:${orderId}` }],
      [csButton(settings)],
      [{ text: "← Menu", callback_data: "home" }]
    ]
  );
}

export async function cancelDeposit(chatId, messageId, orderId) {
  const session = await getSession(chatId);
  const user = await linkedUser(session);
  if (!user) return showHome(chatId, messageId, "Gagal membatalkan.");

  const r = await cancelDepositForToken({ token: user.token, orderId });

  // Dibatalkan tepat saat pembayarannya masuk: saldonya sudah dikreditkan, jadi
  // ini kabar baik, bukan kegagalan.
  if (r.depositStatus === "completed") {
    return sendMessage(chatId, `✅ Ternyata sudah dibayar — saldo sudah masuk.`, [
      [{ text: "📱 Beli Nokos", callback_data: "buy" }],
      [{ text: "← Menu", callback_data: "home" }]
    ]);
  }
  if (!r.ok) {
    return sendMessage(chatId, `❌ ${esc(r.error || "Gagal membatalkan.")}`, [
      [{ text: "← Menu", callback_data: "home" }]
    ]);
  }

  return sendMessage(chatId, `🚫 Deposit dibatalkan. Tidak ada saldo yang terpotong.`, [
    [{ text: "💰 Deposit Lagi", callback_data: "dep" }],
    [{ text: "← Menu", callback_data: "home" }]
  ]);
}

// ─────────────────────────── ADMIN BOT ───────────────────────────

export async function showAdminPanel(chatId, messageId) {
  if (!isShopBotOwner(chatId)) return showHome(chatId, messageId);
  const users = await usersCol();
  const orders = await otpOrdersCol();
  const sessions = await (await import("@/lib/db")).botSessionsCol();

  const [totalUser, totalOrder, botUser, botLinked] = await Promise.all([
    users.countDocuments(),
    orders.countDocuments(),
    sessions.countDocuments(),
    sessions.countDocuments({ token: { $ne: null } })
  ]);

  return editMessage(
    chatId,
    messageId,
    `🛠  <b>PANEL ADMIN BOT</b>\n${RULE}\n\n` +
      `👥 User web      ╸ ${totalUser}\n` +
      `🤖 User bot      ╸ ${botUser}\n` +
      `🔗 Sudah tertaut ╸ ${botLinked}\n` +
      `📦 Total pesanan ╸ ${totalOrder}\n\n` +
      `Kirim <code>/broadcast pesan</code> untuk menyiarkan ke semua user bot.`,
    [
      [{ text: "📢 Broadcast", callback_data: "adm_bc" }],
      [{ text: "← Menu", callback_data: "home" }]
    ]
  );
}

export async function askBroadcast(chatId, messageId) {
  if (!isShopBotOwner(chatId)) return showHome(chatId, messageId);
  await setSession(chatId, { step: "broadcast" });
  return editMessage(
    chatId,
    messageId,
    `📢  <b>BROADCAST</b>\n${RULE}\n\nKetik pesan yang mau disiarkan ke semua user bot.\n\n<i>Mendukung HTML sederhana: &lt;b&gt;tebal&lt;/b&gt;, &lt;i&gt;miring&lt;/i&gt;.</i>`,
    [[{ text: "← Batal", callback_data: "adm" }]]
  );
}

export async function doBroadcast(chatId, text) {
  if (!isShopBotOwner(chatId)) return;
  await clearStep(chatId);

  const sessions = await (await import("@/lib/db")).botSessionsCol();
  const all = await sessions.find({}, { projection: { chatId: 1 } }).toArray();

  await sendMessage(chatId, `📤 Mengirim ke ${all.length} chat…`);

  let ok = 0;
  let fail = 0;
  for (const s of all) {
    const r = await sendMessage(s.chatId, `📢  <b>PENGUMUMAN</b>\n${RULE}\n\n${text}`);
    if (r?.ok) ok++;
    else fail++;
    // Telegram membatasi ~30 pesan/detik; jeda kecil menjaga agar tidak diblokir.
    await new Promise((r2) => setTimeout(r2, 40));
  }

  return sendMessage(chatId, `✅ Broadcast selesai.\n\nTerkirim ╸ ${ok}\nGagal ╸ ${fail}`, [
    [{ text: "← Menu", callback_data: "home" }]
  ]);
}
