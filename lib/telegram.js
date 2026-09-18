// Notifikasi ke channel/grup Telegram untuk event deposit, pembelian nomor OTP,
// dan aksi admin (saldo manual, markup, maintenance) — diformat detail & rapi.
// Diam-diam nonaktif kalau TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID belum diisi,
// supaya tidak mengganggu alur utama kalau env belum lengkap.

// Semua teks dinamis (nama, catatan, judul) WAJIB di-escape karena notif dikirim
// dengan parse_mode HTML — karakter "<" atau "&" yang tidak di-escape bikin Telegram
// menolak pesan dan notifnya hilang diam-diam.
export function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function maskToken(token = "") {
  if (!token) return "-";
  if (token.length <= 8) return token;
  return `${token.slice(0, 4)}••••${token.slice(-4)}`;
}

function fmtWIB(d) {
  if (!d) return "-";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }) + " WIB";
}

function durationText(fromDate, toDate = new Date()) {
  const ms = new Date(toDate).getTime() - new Date(fromDate).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} detik`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} menit ${s % 60} detik`;
  return `${Math.floor(m / 60)} jam ${m % 60} menit`;
}

function userLine(token, name) {
  return `👤 Akun : <code>${maskToken(token)}</code>${name ? ` (${esc(name)})` : ""}\n`;
}

function maskTarget(target = "") {
  const t = String(target || "").trim();
  if (!t) return "-";
  try {
    const u = new URL(t);
    const path = u.pathname.replace(/\/+$/, "");
    const shown = path.length > 5 ? `${path.slice(0, 5)}••••` : path;
    return `${u.hostname}${shown}`;
  } catch {
    return t.length > 4 ? `${t.slice(0, 3)}••••` : "••••";
  }
}

function nowWIB() {
  return new Date().toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }) + " WIB";
}

function rupiah(n) {
  return `Rp${Number(n || 0).toLocaleString("id-ID")}`;
}

const DIVIDER = "┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈";

function channelFooter() {
  const chan1 = process.env.TELEGRAM_CHANNEL_1 || "https://t.me/kkaelnokosmurah";
  const chan2 = process.env.TELEGRAM_CHANNEL_2 || "https://t.me/diskusiduniotp";
  return (
    `\n${DIVIDER}\n` +
    `📢 <a href="${chan1}">Channel Info &amp; Promo</a>\n` +
    `💬 <a href="${chan2}">Diskusi Dunia OTP</a>`
  );
}

// ------------------------------------------------------------------ DEPOSIT

const PROVIDER_LABEL = {
  simuru: "QRIS Simuru",
  pakasir: "QRIS Pakasir",
  rumahotp: "QRIS RumahOTP"
};

function providerLabel(p) {
  return PROVIDER_LABEL[p] || p || "-";
}

export function depositPendingNotif({ orderId, providerRef, provider, amount, fee, total, expiredAt, token, name }) {
  const prov = providerLabel(provider);
  const provShort = prov.replace("QRIS ", "");
  const hasRef = providerRef && providerRef !== orderId;
  const hasFee = fee && Number(fee) > 0;
  const hasTotal = total && Number(total) !== Number(amount);

  return (
    `🟡 <b>DEPOSIT — MENUNGGU PEMBAYARAN</b>\n` +
    `${DIVIDER}\n` +
    `💳 Metode : <b>${esc(prov)}</b>\n\n` +
    `📋 <b>Informasi Transaksi</b>\n` +
    `├ 🧾 ID Order      : <code>${esc(orderId)}</code>\n` +
    (hasRef
      ? `└ 🔖 Ref ${esc(provShort).padEnd(8)} : <code>${esc(providerRef)}</code>\n\n`
      : `\n`) +
    `💸 <b>Rincian Pembayaran</b>\n` +
    `├ 📦 Nominal       : <b>${rupiah(amount)}</b>\n` +
    (hasFee ? `├ 🧮 Biaya admin   : ${rupiah(fee)}\n` : ``) +
    (hasTotal
      ? `└ 💵 Total dibayar  : <b>${rupiah(total)}</b>\n\n`
      : `\n`) +
    `👤 <b>Akun Pengguna</b>\n` +
    `├ 🔑 Token         : <code>${maskToken(token)}</code>\n` +
    (name
      ? `└ 📛 Nama          : ${esc(name)}\n\n`
      : `\n`) +
    `⏱️ <b>Batas Waktu</b>\n` +
    `├ 🕒 Dibuat        : ${nowWIB()}\n` +
    `└ ⏳ Berlaku s/d   : <b>${fmtWIB(expiredAt)}</b>\n` +
    `${DIVIDER}\n` +
    `⚡ <i>Menunggu user scan &amp; bayar QRIS...</i>` +
    channelFooter()
  );
}

export function depositSuccessNotif({
  orderId,
  providerRef,
  provider,
  amount,
  fee,
  total,
  token,
  name,
  balanceBefore,
  balance,
  cashback = 0,
  referralBonus = 0,
  createdAt,
  depositCount
}) {
  const paidIn = createdAt ? durationText(createdAt) : null;
  return (
    `✅ <b>DEPOSIT BERHASIL</b>\n` +
    `${DIVIDER}\n` +
    `💳 Metode : <b>${providerLabel(provider)}</b>\n` +
    `🧾 ID Deposit : <code>${esc(orderId)}</code>\n` +
    (providerRef && providerRef !== orderId ? `🔖 Ref ${esc(providerLabel(provider).replace("QRIS ", ""))} : <code>${esc(providerRef)}</code>\n` : "") +
    `💰 Nominal masuk : <b>${rupiah(amount)}</b>\n` +
    (fee ? `🧮 Biaya admin : ${rupiah(fee)}\n` : "") +
    (total && Number(total) !== Number(amount) ? `💵 Total dibayar user : ${rupiah(total)}\n` : "") +
    (cashback > 0 ? `🎁 Cashback : <b>+${rupiah(cashback)}</b>\n` : "") +
    (referralBonus > 0 ? `🤝 Bonus ke pengundang : +${rupiah(referralBonus)}\n` : "") +
    `${DIVIDER}\n` +
    userLine(token, name) +
    (balanceBefore !== undefined && balanceBefore !== null ? `🏦 Saldo sebelum : ${rupiah(balanceBefore)}\n` : "") +
    `🏦 Saldo sekarang : <b>${rupiah(balance)}</b>\n` +
    (depositCount ? `📈 Deposit sukses ke : <b>${depositCount}</b>\n` : "") +
    (paidIn ? `⚡ Dibayar dalam : ${paidIn}\n` : "") +
    `🕒 Waktu : ${nowWIB()}\n` +
    `Saldo otomatis masuk ke akun user. 🎉` +
    channelFooter()
  );
}

export function depositCanceledNotif({ orderId, provider, amount, token, name, reason }) {
  return (
    `⚪ <b>DEPOSIT ${reason === "expired" ? "KEDALUWARSA" : "DIBATALKAN"}</b>\n` +
    `${DIVIDER}\n` +
    `💳 Metode : ${providerLabel(provider)}\n` +
    `🧾 ID Deposit : <code>${esc(orderId)}</code>\n` +
    `💰 Nominal : ${rupiah(amount)}\n` +
    userLine(token, name) +
    `🕒 Waktu : ${nowWIB()}` +
    channelFooter()
  );
}

// ------------------------------------------------------------------ OTP

export function otpPurchaseNotif({ orderId, serviceName, countryName, phoneNumber, price, token, name, operator, balance }) {
  return (
    `📱 <b>NOMOR OTP TERJUAL</b>\n` +
    `${DIVIDER}\n` +
    `🧾 Order : <code>${esc(orderId)}</code>\n` +
    `📦 Layanan : <b>${esc(serviceName || "-")}</b>\n` +
    `🌍 Negara : ${esc(countryName || "-")}\n` +
    (operator ? `📶 Operator : ${esc(operator)}\n` : "") +
    `☎️ Nomor : <code>${esc(phoneNumber || "-")}</code>\n` +
    `💵 Harga : <b>${rupiah(price)}</b>\n` +
    userLine(token, name) +
    (balance !== undefined && balance !== null ? `🏦 Sisa saldo : ${rupiah(balance)}\n` : "") +
    `🕒 Waktu : ${nowWIB()}` +
    channelFooter()
  );
}

export function otpReceivedNotif({ orderId, serviceName, countryName, phoneNumber, otpCode, token, createdAt }) {
  const waited = createdAt ? durationText(createdAt) : null;
  return (
    `🔓 <b>KODE OTP DITERIMA</b>\n` +
    `${DIVIDER}\n` +
    `🧾 Order : <code>${esc(orderId)}</code>\n` +
    `📦 Layanan : <b>${esc(serviceName || "-")}</b>\n` +
    `🌍 Negara : ${esc(countryName || "-")}\n` +
    `☎️ Nomor : <code>${esc(phoneNumber || "-")}</code>\n` +
    `🔑 Kode OTP : <code>${esc(otpCode)}</code>\n` +
    (waited ? `⏱️ Masuk setelah : ${waited}\n` : "") +
    userLine(token) +
    `🕒 Waktu : ${nowWIB()}` +
    channelFooter()
  );
}

// ------------------------------------------------------------------ SUNTIK SOSMED

export function smmOrderNotif({
  id,
  providerOrderId,
  platform,
  kind,
  serviceTitle,
  target,
  quantity,
  pricePer1k,
  charge,
  token,
  name,
  balance,
  speedLabel
}) {
  return (
    `🚀 <b>ORDER SUNTIK SOSMED</b>\n` +
    `${DIVIDER}\n` +
    `🧾 Order : <code>${esc(id)}</code>${providerOrderId ? ` (Simuru #${esc(providerOrderId)})` : ""}\n` +
    `📲 Platform : <b>${esc(platform || "-")}</b>${kind ? ` · ${esc(kind)}` : ""}\n` +
    `🛠️ Layanan : ${esc(serviceTitle || "-")}\n` +
    `🎯 Target : <code>${esc(maskTarget(target))}</code>\n` +
    `🔢 Jumlah : <b>${Number(quantity || 0).toLocaleString("id-ID")}</b>\n` +
    `🏷️ Harga /1.000 : ${rupiah(pricePer1k)}\n` +
    `💵 Total : <b>${rupiah(charge)}</b>\n` +
    (speedLabel ? `⚡ Estimasi : ${esc(speedLabel)}\n` : "") +
    userLine(token, name) +
    (balance !== undefined && balance !== null ? `🏦 Sisa saldo : ${rupiah(balance)}\n` : "") +
    `🕒 Waktu : ${nowWIB()}` +
    channelFooter()
  );
}

const SMM_STATUS_TITLE = {
  completed: "✅ <b>SUNTIK SOSMED SELESAI</b>",
  partial: "🟠 <b>SUNTIK SOSMED SELESAI SEBAGIAN</b>",
  canceled: "↩️ <b>SUNTIK SOSMED DIBATALKAN</b>",
  refunded: "↩️ <b>SUNTIK SOSMED DIREFUND</b>",
  error: "❌ <b>SUNTIK SOSMED GAGAL</b>"
};

export function smmStatusNotif({ id, platform, serviceTitle, target, quantity, status, startCount, remains, refundAmount, token, createdAt }) {
  const took = createdAt ? durationText(createdAt) : null;
  return (
    `${SMM_STATUS_TITLE[status] || `ℹ️ <b>STATUS SUNTIK: ${esc(String(status).toUpperCase())}</b>`}\n` +
    `${DIVIDER}\n` +
    `🧾 Order : <code>${esc(id)}</code>\n` +
    `📲 Platform : ${esc(platform || "-")}\n` +
    `🛠️ Layanan : ${esc(serviceTitle || "-")}\n` +
    `🎯 Target : <code>${esc(maskTarget(target))}</code>\n` +
    `🔢 Dipesan : ${Number(quantity || 0).toLocaleString("id-ID")}\n` +
    (startCount !== null && startCount !== undefined ? `📊 Jumlah awal : ${Number(startCount).toLocaleString("id-ID")}\n` : "") +
    (remains !== null && remains !== undefined ? `⏳ Sisa belum masuk : ${Number(remains).toLocaleString("id-ID")}\n` : "") +
    (refundAmount > 0 ? `💸 Refund ke user : <b>${rupiah(refundAmount)}</b>\n` : "") +
    (took ? `⏱️ Durasi : ${took}\n` : "") +
    userLine(token) +
    `🕒 Waktu : ${nowWIB()}` +
    channelFooter()
  );
}

// Peringatan khusus admin kalau saldo akun Simuru kurang / API bermasalah.
export function providerAlertNotif({ provider, action, message }) {
  return (
    `⚠️ <b>PERINGATAN PROVIDER</b>\n` +
    `${DIVIDER}\n` +
    `🔌 Provider : <b>${esc(provider)}</b>\n` +
    `🧩 Aksi : ${esc(action)}\n` +
    `📝 Pesan : ${esc(message)}\n` +
    `🕒 Waktu : ${nowWIB()}\n` +
    `Cek saldo / API key provider di dashboard mereka.`
  );
}

// ------------------------------------------------------------------ TRANSFER

export function transferNotif({ fromToken, toToken, amount, fromBalance }) {
  return (
    `🔁 <b>TRANSFER SALDO</b>\n` +
    `${DIVIDER}\n` +
    `📤 Dari : <code>${maskToken(fromToken)}</code>\n` +
    `📥 Ke : <code>${maskToken(toToken)}</code>\n` +
    `💰 Nominal : <b>${rupiah(amount)}</b>\n` +
    (fromBalance !== undefined ? `🏦 Sisa saldo pengirim : ${rupiah(fromBalance)}\n` : "") +
    `🕒 Waktu : ${nowWIB()}` +
    channelFooter()
  );
}

export function newUserNotif({ token, referredBy, userCount }) {
  const isRef = Boolean(referredBy);
  const countLine = userCount ? `📊 Member ke   : <b>#${Number(userCount).toLocaleString("id-ID")}</b>\n` : "";
  return (
    `🎉🎊 <b>PENGGUNA BARU BERGABUNG!</b> 🎊🎉\n` +
    `${DIVIDER}\n` +
    `\n` +
    `🆔 <b>Identitas Akun</b>\n` +
    `├ 🔑 Token       : <code>${maskToken(token)}</code>\n` +
    `└ 📅 Daftar      : <b>${nowWIB()}</b>\n` +
    `\n` +
    `📈 <b>Statistik</b>\n` +
    (countLine ? `├ ${countLine.trimEnd()}\n` : "") +
    `└ 🔗 Via referral : <b>${isRef ? "✅ YA" : "❌ Tidak"}</b>\n` +
    (isRef
      ? `\n` +
        `🤝 <b>Referral</b>\n` +
        `└ 👤 Diundang oleh : <code>${maskToken(referredBy)}</code>\n`
      : "") +
    `\n` +
    `${DIVIDER}\n` +
    `🚀 <i>User baru siap bertransaksi di Artapedia!</i>` +
    channelFooter()
  );
}

export function otpAutoRefundNotif({ orderId, serviceName, countryName, price, token, reason }) {
  return (
    `↩️ <b>REFUND OTOMATIS</b>\n` +
    `${DIVIDER}\n` +
    `🧾 Order lama : <code>${orderId}</code>\n` +
    `📦 Layanan : <b>${esc(serviceName || "-")}</b>\n` +
    `🌍 Negara : ${esc(countryName || "-")}\n` +
    `💵 Nominal dikembalikan : <b>${rupiah(price)}</b>\n` +
    `👤 Akun : <code>${maskToken(token)}</code>\n` +
    `🕒 Waktu : ${nowWIB()}\n` +
    `${esc(reason || "Pesanan tidak menerima kode, saldo user dikembalikan otomatis.")}` +
    channelFooter()
  );
}

export function voucherCreatedNotif({ code, amount, maxUses }) {
  return (
    `🎟️ <b>VOUCHER BARU DIBUAT</b>\n` +
    `${DIVIDER}\n` +
    `🔑 Kode : <code>${esc(code)}</code>\n` +
    `💰 Nominal : <b>${rupiah(amount)}</b>\n` +
    `👥 Kuota : <b>${maxUses}x</b> klaim\n` +
    `🕒 Waktu : ${nowWIB()}` +
    channelFooter()
  );
}

export function voucherRedeemedNotif({ code, amount, token, remainingUses }) {
  return (
    `✅ <b>VOUCHER DIKLAIM</b>\n` +
    `${DIVIDER}\n` +
    `🔑 Kode : <code>${esc(code)}</code>\n` +
    `💰 Nominal : <b>${rupiah(amount)}</b>\n` +
    `👤 Akun : <code>${maskToken(token)}</code>\n` +
    `🎫 Sisa kuota : ${remainingUses}x\n` +
    `🕒 Waktu : ${nowWIB()}` +
    channelFooter()
  );
}

export function pointsRedeemedNotif({ token, points, rupiah: rp, newBalance, remainingPoints }) {
  return (
    `🎟️ <b>POIN DITUKAR</b>\n` +
    `${DIVIDER}\n` +
    `⭐ Poin ditukar : <b>${Number(points).toLocaleString("id-ID")}</b>\n` +
    `💰 Jadi saldo : <b>${rupiah(rp)}</b>\n` +
    `🏦 Saldo baru : <b>${rupiah(newBalance)}</b>\n` +
    `👤 Akun : <code>${maskToken(token)}</code>\n` +
    `⭐ Sisa poin : ${Number(remainingPoints).toLocaleString("id-ID")}\n` +
    `🕒 Waktu : ${nowWIB()}` +
    channelFooter()
  );
}

// Notif saat admin menambah/mengurangi saldo user secara manual dari dashboard admin.
export function adminBalanceAdjustNotif({ token, amount, action, newBalance, note }) {
  const isAdd = action === "add";
  return (
    `${isAdd ? "🟢" : "🔴"} <b>SALDO ${isAdd ? "DITAMBAH" : "DIKURANGI"} ADMIN</b>\n` +
    `${DIVIDER}\n` +
    `👤 Akun : <code>${maskToken(token)}</code>\n` +
    `${isAdd ? "➕" : "➖"} Nominal : <b>${rupiah(amount)}</b>\n` +
    `🏦 Saldo baru : <b>${rupiah(newBalance)}</b>\n` +
    (note ? `📝 Catatan : ${esc(note)}\n` : "") +
    `🕒 Waktu : ${nowWIB()}\n` +
    `Perubahan dilakukan manual lewat dashboard admin.` +
    channelFooter()
  );
}

// Notif saat admin mengubah persentase markup harga jual OTP.
export function markupUpdateNotif({ oldPercent, newPercent }) {
  return (
    `⚙️ <b>MARKUP HARGA DIUBAH</b>\n` +
    `${DIVIDER}\n` +
    `📉 Sebelumnya : <b>${oldPercent}%</b>\n` +
    `📈 Sekarang : <b>${newPercent}%</b>\n` +
    `🕒 Waktu : ${nowWIB()}\n` +
    `Harga jual nomor OTP otomatis menyesuaikan.` +
    channelFooter()
  );
}

// Notif saat admin menyalakan/mematikan mode maintenance.
export function maintenanceToggleNotif({ maintenance }) {
  return (
    `${maintenance ? "🛠️" : "✅"} <b>MODE MAINTENANCE ${maintenance ? "AKTIF" : "NONAKTIF"}</b>\n` +
    `${DIVIDER}\n` +
    `${maintenance ? "Website untuk sementara ditutup dari user." : "Website sudah bisa diakses normal lagi."}\n` +
    `🕒 Waktu : ${nowWIB()}` +
    channelFooter()
  );
}

// Notif saat admin mengirim broadcast baru (banner mengambang di semua halaman).
export function broadcastCreatedNotif({ message }) {
  return (
    `📣 <b>BROADCAST BARU DIKIRIM</b>\n` +
    `${DIVIDER}\n` +
    `${esc(message)}\n` +
    `🕒 Waktu : ${nowWIB()}` +
    channelFooter()
  );
}

// Notif saat admin membuat pengumuman baru di Pusat Informasi.
export function announcementCreatedNotif({ title, category }) {
  return (
    `📝 <b>PENGUMUMAN BARU DITERBITKAN</b>\n` +
    `${DIVIDER}\n` +
    `Judul : <b>${esc(title)}</b>\n` +
    `Kategori : ${esc(category)}\n` +
    `🕒 Waktu : ${nowWIB()}` +
    channelFooter()
  );
}

// URL website order nokos — tombol ini otomatis disematkan ke SEMUA notif Telegram di bawah.
const WEB_ORDER_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://artapedianokosmurahid.vercel.app/";

// Fire-and-forget: sengaja tidak dilempar (throw) ke pemanggil supaya kegagalan
// kirim notif Telegram tidak pernah menggagalkan transaksi deposit/pembelian.
export async function sendTelegramNotif(text) {
  let botToken = process.env.TELEGRAM_BOT_TOKEN;
  let chatId = process.env.TELEGRAM_CHAT_ID;
  try {
    const { getSettings } = await import("@/lib/settings");
    const s = await getSettings();
    if (s.telegramBotToken) botToken = s.telegramBotToken;
    if (s.telegramChatId) chatId = s.telegramChatId;
  } catch {}
  if (!botToken || !chatId) return;

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: {
          inline_keyboard: [[{ text: "🛒 Order Nokos di Web", url: WEB_ORDER_URL }]]
        }
      })
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.error("Gagal kirim notif Telegram:", res.status, errBody);
    }
  } catch (err) {
    console.error("Gagal kirim notif Telegram:", err?.message || err);
  }
}

// Kirim notif ke channel Telegram (bukan admin chat). Dipakai untuk notif
// yang layak ditampilkan ke publik/member channel, mis: user baru bergabung.
export async function sendTelegramChannelNotif(text) {
  let botToken = process.env.TELEGRAM_BOT_TOKEN;
  let channelId = process.env.TELEGRAM_CHANNEL_ID;
  try {
    const { getSettings } = await import("@/lib/settings");
    const s = await getSettings();
    if (s.telegramBotToken) botToken = s.telegramBotToken;
    if (s.telegramChannelId) channelId = s.telegramChannelId;
  } catch {}
  if (!botToken || !channelId) return;

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: channelId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: {
          inline_keyboard: [[{ text: "🛒 Order Nokos di Web", url: WEB_ORDER_URL }]]
        }
      })
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.error("Gagal kirim notif channel Telegram:", res.status, errBody);
    }
  } catch (err) {
    console.error("Gagal kirim notif channel Telegram:", err?.message || err);
  }
}

// Kirim gambar struk PNG ke Telegram sebagai foto dengan caption teks.
// pngBuffer: Buffer hasil generateReceiptPng()
// caption: teks HTML pendek (opsional, maks 1024 karakter)
export async function sendTelegramPhoto(pngBuffer, caption) {
  let botToken = process.env.TELEGRAM_BOT_TOKEN;
  let chatId = process.env.TELEGRAM_CHAT_ID;
  try {
    const { getSettings } = await import("@/lib/settings");
    const s = await getSettings();
    if (s.telegramBotToken) botToken = s.telegramBotToken;
    if (s.telegramChatId) chatId = s.telegramChatId;
  } catch {}
  if (!botToken || !chatId || !pngBuffer) return;

  try {
    const form = new FormData();
    form.append("chat_id", chatId);
    form.append("photo", new Blob([pngBuffer], { type: "image/png" }), "struk.png");
    if (caption) {
      form.append("caption", caption);
      form.append("parse_mode", "HTML");
    }
    form.append(
      "reply_markup",
      JSON.stringify({ inline_keyboard: [[{ text: "🛒 Order Nokos di Web", url: WEB_ORDER_URL }]] })
    );

    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.error("Gagal kirim foto struk Telegram:", res.status, errBody);
    }
  } catch (err) {
    console.error("Gagal kirim foto struk Telegram:", err?.message || err);
  }
}
