// Alur percakapan BOT TOKO Artapedia.
//
// Prinsip yang dipegang:
//  - Saldo TIDAK pernah dihitung ulang di sini. Order memakai placeOtpOrder dan
//    deposit memakai endpoint /api/deposit/create yang sama dengan web, jadi
//    saldo di web dan di bot selalu satu sumber yang sama.
//  - Data callback Telegram dibatasi 64 byte, jadi daftar layanan/negara
//    disimpan di sesi dan tombolnya hanya mengirim nomor urut.
import { usersCol } from "@/lib/db";
import { getSettings, serverDisplay, depositDisplay, markupForServer } from "@/lib/settings";
import { OTP_SERVERS } from "@/lib/otpServers";
import { PROVIDER_KEYS } from "@/lib/paymentProviders";
import { listServices, listCountries } from "@/lib/otpCatalog";
import { placeOtpOrder } from "@/lib/otpOrderService";
import { reconcileOtpOrder } from "@/lib/orderReconcile";
import { otpOrdersCol, depositsCol } from "@/lib/db";
import { generateUserToken } from "@/lib/token";
import { sendTelegramNotif, sendTelegramChannelNotif, newUserNotif } from "@/lib/telegram";
import {
  sendMessage,
  editMessage,
  answerCallback,
  sendQrPhoto,
  getSession,
  setSession,
  clearStep,
  isShopBotOwner,
  rupiah,
  esc
} from "@/lib/shopBot";

const PER_PAGE = 8;

function csUsername(settings) {
  return (settings?.csUsername || "teatlas").replace(/^@/, "");
}

function siteUrl(settings) {
  return (settings?.siteUrl || process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/+$/, "");
}

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

export async function showHome(chatId, messageId = null, flash = "") {
  const settings = await getSettings();
  const session = await getSession(chatId);
  const user = await linkedUser(session);
  await clearStep(chatId);

  const saldo = user ? rupiah(user.balance) : "belum tertaut";
  const akun = user ? `<code>${esc(user.token)}</code>` : "—";

  const text =
    `🦅 <b>ARTA PEDIA ID</b>\n` +
    `<i>Nokos termurah dan fast</i>\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    (flash ? `${flash}\n\n` : "") +
    (user
      ? `👤 Akun  ╸ ${akun}\n💰 Saldo ╸ <b>${saldo}</b>\n\n` +
        `Saldo ini sama persis dengan yang ada di web. Dipakai di mana pun, potongannya satu.`
      : `Kamu belum menautkan akun.\n\n` +
        `Punya kode akun dari web? Tekan <b>Login</b>.\n` +
        `Belum punya? Tekan <b>Buat Akun</b> — gratis, dan saldonya langsung bisa dipakai di web juga.`) +
    `\n\n━━━━━━━━━━━━━━━━━━━━\n` +
    `Pilih menu di bawah 👇`;

  const keyboard = [
    [
      { text: "📱 Beli Nokos", callback_data: "buy" },
      { text: "💰 Deposit", callback_data: "dep" }
    ],
    user
      ? [
          { text: "🧾 Pesanan Saya", callback_data: "orders" },
          { text: "👤 Akun", callback_data: "acc" }
        ]
      : [
          { text: "🔑 Login Kode Akun", callback_data: "login" },
          { text: "✨ Buat Akun", callback_data: "reg" }
        ],
    [{ text: "ℹ️ Informasi", callback_data: "info" }],
    [csButton(settings)]
  ];

  const web = siteUrl(settings);
  if (web) keyboard.push([{ text: "🌐 Buka Website", url: web }]);

  return messageId ? editMessage(chatId, messageId, text, keyboard) : sendMessage(chatId, text, keyboard);
}

// ─────────────────────────── AKUN ───────────────────────────

export async function askLogin(chatId, messageId) {
  await setSession(chatId, { step: "login" });
  return editMessage(
    chatId,
    messageId,
    `🔑 <b>Login Kode Akun</b>\n━━━━━━━━━━━━━━━━━━━━\n\n` +
      `Kirim kode akun kamu di chat ini.\n\n` +
      `Bentuknya seperti: <code>AP-1A2B-3C4D-5E6F</code>\n` +
      `Bisa dilihat di web pada menu <b>Beranda → Kode akun</b>.\n\n` +
      `Setelah tertaut, saldo di web dan di bot jadi satu.`,
    [[{ text: "← Batal", callback_data: "home" }]]
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
  sendTelegramNotif(notif);
  sendTelegramChannelNotif(notif);

  const settings = await getSettings();
  const web = siteUrl(settings);
  return editMessage(
    chatId,
    messageId,
    `✨ <b>Akun berhasil dibuat!</b>\n━━━━━━━━━━━━━━━━━━━━\n\n` +
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
    `👤 <b>Akun Kamu</b>\n━━━━━━━━━━━━━━━━━━━━\n\n` +
      `🔑 Kode    ╸ <code>${esc(user.token)}</code>\n` +
      `💰 Saldo   ╸ <b>${rupiah(user.balance)}</b>\n` +
      `📦 Pesanan ╸ ${total} (${sukses} sukses)\n\n` +
      `Kode akun ini juga dipakai untuk masuk di web. Saldonya satu, tidak terpisah.`,
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
    `ℹ️ <b>Informasi Arta Pedia</b>\n━━━━━━━━━━━━━━━━━━━━\n\n` +
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
      `📱 <b>Beli Nokos</b>\n━━━━━━━━━━━━━━━━━━━━\n\nSemua server sedang ditutup sementara. Coba lagi nanti ya.`,
      [[csButton(settings)], [{ text: "← Menu", callback_data: "home" }]]
    );
  }

  rows.push([{ text: "← Menu", callback_data: "home" }]);
  return editMessage(
    chatId,
    messageId,
    `📱 <b>Beli Nokos</b>\n━━━━━━━━━━━━━━━━━━━━\n\n` +
      (user ? `💰 Saldo kamu: <b>${rupiah(user.balance)}</b>\n\n` : `⚠️ Akun belum tertaut — login dulu sebelum order.\n\n`) +
      `Pilih server dulu:`,
    rows
  );
}

export async function chooseServer(chatId, messageId, serverKey) {
  const settings = await getSettings();
  const d = serverDisplay(settings, serverKey);
  if (!d.enabled) return showServers(chatId, messageId);

  await editMessage(chatId, messageId, `⏳ Memuat daftar aplikasi di <b>${esc(d.name)}</b>…`);

  let services;
  try {
    services = await listServices(serverKey);
  } catch (err) {
    return editMessage(
      chatId,
      messageId,
      `❌ Gagal memuat aplikasi dari ${esc(d.name)}.\n\n<code>${esc(err?.message || "gagal")}</code>`,
      [[{ text: "← Pilih Server Lain", callback_data: "buy" }]]
    );
  }

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
  rows.push([{ text: "🔍 Cari Aplikasi", callback_data: "svq" }]);
  rows.push([{ text: "← Ganti Server", callback_data: "buy" }]);

  await setSession(chatId, { svPage: p });
  const d = serverDisplay(settings, session.server);
  return editMessage(
    chatId,
    messageId,
    `📱 <b>${esc(d.name)}</b>\n━━━━━━━━━━━━━━━━━━━━\n\n` +
      (q ? `🔍 Pencarian: <b>${esc(session.query)}</b>\n` : "") +
      `Pilih aplikasi (${items.length} tersedia) — halaman ${p + 1}/${pages}:`,
    rows
  );
}

export async function askServiceQuery(chatId, messageId) {
  await setSession(chatId, { step: "svq" });
  return editMessage(
    chatId,
    messageId,
    `🔍 <b>Cari Aplikasi</b>\n━━━━━━━━━━━━━━━━━━━━\n\nKetik nama aplikasinya, mis. <code>whatsapp</code>`,
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
    `🌍 <b>${esc(session.service?.n || "-")}</b>\n━━━━━━━━━━━━━━━━━━━━\n\n` +
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
      `━━━━━━━━━━━━━━━━━━━━\n\nPilih paket:`,
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
      `🔑 <b>Login dulu</b>\n━━━━━━━━━━━━━━━━━━━━\n\nUntuk order, akunmu harus tertaut dulu.`,
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
    `🧾 <b>Konfirmasi Pesanan</b>\n━━━━━━━━━━━━━━━━━━━━\n\n` +
      `📱 Aplikasi ╸ <b>${esc(session.service?.n || "-")}</b>\n` +
      `🌍 Negara   ╸ ${c.f ? `${c.f} ` : ""}${esc(c.n)}\n` +
      `🖥 Server   ╸ ${esc(d.name)}\n` +
      `📦 Paket    ╸ ${esc(price.nm)}\n` +
      `💵 Harga    ╸ <b>${rupiah(price.s)}</b>\n\n` +
      `💰 Saldo    ╸ ${rupiah(user.balance)}\n` +
      (kurang
        ? `\n⚠️ <b>Saldo kurang ${rupiah(price.s - user.balance)}.</b> Isi saldo dulu ya.`
        : `💳 Sisa nanti ╸ ${rupiah(user.balance - price.s)}`),
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

  await editMessage(chatId, messageId, "⏳ Memproses pesanan… mohon tunggu sebentar.");

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

  if (!result.ok) {
    return editMessage(
      chatId,
      messageId,
      `❌ <b>Pesanan gagal</b>\n━━━━━━━━━━━━━━━━━━━━\n\n${esc(result.error)}`,
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
      [{ text: "🧾 Pesanan Saya", callback_data: "orders" }],
      [{ text: "← Menu", callback_data: "home" }]
    ]
  );
}

function orderText(order, serviceName, countryName, statusLabel, otp = null) {
  return (
    `${otp ? "🎉 <b>KODE OTP MASUK!</b>" : "✅ <b>Nomor Didapat</b>"}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `📱 Aplikasi ╸ <b>${esc(serviceName || "-")}</b>\n` +
    `🌍 Negara   ╸ ${esc(countryName || "-")}\n` +
    `☎️ Nomor    ╸ <code>${esc(order.phoneNumber)}</code>\n` +
    `💵 Harga    ╸ ${rupiah(order.price)}\n` +
    `🆔 Order    ╸ <code>${esc(order.orderId)}</code>\n\n` +
    (otp
      ? `🔐 <b>KODE OTP</b>\n<code>${esc(otp)}</code>\n\n<i>Ketuk kode untuk menyalin.</i>`
      : `⏳ Status ╸ <b>${esc(statusLabel)}</b>\n\n` +
        `Ketuk nomor di atas untuk menyalin, lalu pakai di aplikasi tujuan.\n` +
        `Tekan <b>Cek Kode OTP</b> setelah SMS dikirim.`) +
    `\n\n💰 Sisa saldo ╸ <b>${rupiah(order.balance)}</b>`
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
  if (!r.otpCode) rows.push([{ text: "🔄 Cek Lagi", callback_data: `st:${orderId}` }]);
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
    return editMessage(chatId, messageId, `🧾 <b>Pesanan Saya</b>\n━━━━━━━━━━━━━━━━━━━━\n\nBelum ada pesanan.`, [
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
    `🧾 <b>Pesanan Saya</b>\n━━━━━━━━━━━━━━━━━━━━\n\n${body}\n\n💰 Saldo ╸ <b>${rupiah(user.balance)}</b>`,
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
      `🔑 <b>Login dulu</b>\n━━━━━━━━━━━━━━━━━━━━\n\nSaldo menempel di akun, jadi tautkan akunmu dulu ya.`,
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
    const d = depositDisplay(settings, key);
    rows.push([{ text: `${d.badge ? `[${d.badge}] ` : ""}${d.name}`, callback_data: `dpm:${key}` }]);
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
    `💰 <b>Deposit Saldo</b>\n━━━━━━━━━━━━━━━━━━━━\n\n` +
      `💳 Saldo sekarang ╸ <b>${rupiah(user.balance)}</b>\n\n` +
      `Pilih metode pembayaran:`,
    rows
  );
}

export async function askDepositAmount(chatId, messageId, method) {
  const settings = await getSettings();
  const d = depositDisplay(settings, method);
  const min = Math.max(1, settings.depositMin || 2000);
  const max = Math.max(1, settings.depositMax || 1000000);
  await setSession(chatId, { step: "dep_amount", depMethod: method });

  const presets = [10000, 20000, 50000, 100000].filter((v) => v >= min && v <= max);
  const rows = [];
  for (let i = 0; i < presets.length; i += 2) {
    rows.push(
      presets.slice(i, i + 2).map((v) => ({ text: rupiah(v), callback_data: `dpa:${v}` }))
    );
  }
  rows.push([{ text: "← Ganti Metode", callback_data: "dep" }]);

  return editMessage(
    chatId,
    messageId,
    `💰 <b>${esc(d.name)}</b>\n━━━━━━━━━━━━━━━━━━━━\n\n` +
      `Pilih nominal di bawah, atau ketik sendiri angkanya.\n\n` +
      `Minimal ╸ ${rupiah(min)}\nMaksimal ╸ ${rupiah(max)}`,
    rows
  );
}

export async function createDeposit(chatId, amount, messageId = null) {
  const settings = await getSettings();
  const session = await getSession(chatId);
  const user = await linkedUser(session);
  if (!user) return showHome(chatId, messageId, "Akun belum tertaut.");

  const method = session.depMethod || PROVIDER_KEYS[0];
  const base = siteUrl(settings);
  if (!base) {
    return sendMessage(
      chatId,
      `⚠️ Alamat website belum diatur admin, jadi deposit lewat bot belum bisa dipakai.`,
      [[csButton(settings)], [{ text: "← Menu", callback_data: "home" }]]
    );
  }

  await clearStep(chatId);
  const loading = await sendMessage(chatId, "⏳ Membuat kode pembayaran…");

  let data;
  try {
    // Memakai endpoint yang sama dengan web, supaya perhitungan biaya, batas
    // nominal, dan pencatatan depositnya persis sama — tidak ada logika uang
    // yang digandakan di bot.
    const res = await fetch(`${base}/api/deposit/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: user.token, amount, provider: method })
    });
    data = await res.json();
    if (!res.ok) throw new Error(data?.error || "Gagal membuat deposit.");
  } catch (err) {
    return sendMessage(chatId, `❌ ${esc(err?.message || "Gagal membuat deposit.")}`, [
      [{ text: "🔁 Coba Lagi", callback_data: "dep" }],
      [csButton(settings)],
      [{ text: "← Menu", callback_data: "home" }]
    ]);
  }

  const d = depositDisplay(settings, method);
  const total = Number(data.totalAmount || amount);
  const caption =
    `💰 <b>Bayar Deposit</b>\n━━━━━━━━━━━━━━━━━━━━\n\n` +
    `🏦 Metode ╸ ${esc(d.name)}\n` +
    `💵 Saldo masuk ╸ ${rupiah(amount)}\n` +
    (data.adminFee ? `🧾 Biaya admin ╸ ${rupiah(data.adminFee)}\n` : "") +
    `💳 <b>TOTAL BAYAR ╸ ${rupiah(total)}</b>\n` +
    `🆔 Order ╸ <code>${esc(data.orderId)}</code>\n\n` +
    `Scan QRIS di atas pakai e-wallet atau m-banking apa saja.\n` +
    `⚠️ Bayar <b>persis ${rupiah(total)}</b> supaya terdeteksi otomatis.\n\n` +
    `Saldo masuk sendiri dalam hitungan detik setelah dibayar.`;

  const rows = [
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
  const base = siteUrl(settings);
  const session = await getSession(chatId);
  const user = await linkedUser(session);

  const deposits = await depositsCol();
  const dep = await deposits.findOne({ orderId });
  if (!dep) return showHome(chatId, messageId, "Deposit tidak ditemukan.");

  // Status ditanyakan lewat endpoint web supaya proses kreditnya satu jalur.
  if (base && user) {
    try {
      await fetch(
        `${base}/api/deposit/status?order_id=${encodeURIComponent(orderId)}&token=${encodeURIComponent(user.token)}`
      );
    } catch {}
  }

  const fresh = await deposits.findOne({ orderId });
  const nowUser = await linkedUser(session);
  const st = fresh?.status || "pending";

  if (st === "completed") {
    return sendMessage(
      chatId,
      `🎉 <b>Deposit Berhasil!</b>\n━━━━━━━━━━━━━━━━━━━━\n\n` +
        `💵 Saldo masuk ╸ <b>${rupiah(fresh.amount)}</b>\n` +
        `💰 Saldo sekarang ╸ <b>${rupiah(nowUser?.balance)}</b>\n\n` +
        `Saldo ini juga langsung bisa dipakai di website.`,
      [
        [{ text: "📱 Beli Nokos", callback_data: "buy" }],
        [{ text: "← Menu", callback_data: "home" }]
      ]
    );
  }

  const label = st === "pending" ? "Menunggu pembayaran" : st;
  return sendMessage(
    chatId,
    `⏳ <b>Status Deposit</b>\n━━━━━━━━━━━━━━━━━━━━\n\n` +
      `🆔 <code>${esc(orderId)}</code>\n` +
      `📊 Status ╸ <b>${esc(label)}</b>\n\n` +
      (st === "pending" ? `Belum terbayar. Kalau sudah bayar, tunggu sebentar lalu cek lagi.` : ""),
    [
      ...(st === "pending" ? [[{ text: "🔄 Cek Lagi", callback_data: `dst:${orderId}` }]] : []),
      [csButton(settings)],
      [{ text: "← Menu", callback_data: "home" }]
    ]
  );
}

export async function cancelDeposit(chatId, messageId, orderId) {
  const settings = await getSettings();
  const base = siteUrl(settings);
  const session = await getSession(chatId);
  const user = await linkedUser(session);
  if (!base || !user) return showHome(chatId, messageId, "Gagal membatalkan.");

  try {
    const res = await fetch(`${base}/api/deposit/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: user.token, orderId })
    });
    const d = await res.json();
    if (!res.ok && d?.status !== "completed") throw new Error(d?.error || "Gagal membatalkan.");
    if (d?.status === "completed") {
      return sendMessage(chatId, `✅ Ternyata sudah dibayar — saldo sudah masuk.`, [
        [{ text: "← Menu", callback_data: "home" }]
      ]);
    }
  } catch (err) {
    return sendMessage(chatId, `❌ ${esc(err?.message || "Gagal membatalkan.")}`, [
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
    `🛠 <b>Panel Admin Bot</b>\n━━━━━━━━━━━━━━━━━━━━\n\n` +
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
    `📢 <b>Broadcast</b>\n━━━━━━━━━━━━━━━━━━━━\n\nKetik pesan yang mau disiarkan ke semua user bot.\n\n<i>Mendukung HTML sederhana: &lt;b&gt;tebal&lt;/b&gt;, &lt;i&gt;miring&lt;/i&gt;.</i>`,
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
    const r = await sendMessage(s.chatId, `📢 <b>PENGUMUMAN</b>\n━━━━━━━━━━━━━━━━━━━━\n\n${text}`);
    if (r?.ok) ok++;
    else fail++;
    // Telegram membatasi ~30 pesan/detik; jeda kecil menjaga agar tidak diblokir.
    await new Promise((r2) => setTimeout(r2, 40));
  }

  return sendMessage(chatId, `✅ Broadcast selesai.\n\nTerkirim ╸ ${ok}\nGagal ╸ ${fail}`, [
    [{ text: "← Menu", callback_data: "home" }]
  ]);
}
