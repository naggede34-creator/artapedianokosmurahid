// Notifikasi ke channel/grup Telegram untuk event deposit, pembelian nomor OTP,
// dan aksi admin (saldo manual, markup, maintenance) — diformat detail & rapi.
// Diam-diam nonaktif kalau TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID belum diisi,
// supaya tidak mengganggu alur utama kalau env belum lengkap.

function maskToken(token = "") {
  if (!token) return "-";
  if (token.length <= 8) return token;
  return `${token.slice(0, 4)}••••${token.slice(-4)}`;
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

export function depositPendingNotif({ orderId, amount, token }) {
  return (
    `🟡 <b>DEPOSIT PENDING</b>\n` +
    `${DIVIDER}\n` +
    `🧾 Order : <code>${orderId}</code>\n` +
    `💰 Nominal : <b>${rupiah(amount)}</b>\n` +
    `👤 Akun : <code>${maskToken(token)}</code>\n` +
    `🕒 Waktu : ${nowWIB()}\n` +
    `Menunggu pembayaran dari user...` +
    channelFooter()
  );
}

export function depositSuccessNotif({ orderId, amount, token, balance, cashback = 0 }) {
  return (
    `✅ <b>DEPOSIT BERHASIL</b>\n` +
    `${DIVIDER}\n` +
    `🧾 Order : <code>${orderId}</code>\n` +
    `💰 Nominal : <b>${rupiah(amount)}</b>\n` +
    (cashback > 0 ? `🎁 Cashback : <b>+${rupiah(cashback)}</b>\n` : "") +
    `🏦 Saldo baru : <b>${rupiah(balance)}</b>\n` +
    `👤 Akun : <code>${maskToken(token)}</code>\n` +
    `🕒 Waktu : ${nowWIB()}\n` +
    `Saldo sudah otomatis masuk ke akun user. 🎉` +
    channelFooter()
  );
}

export function otpPurchaseNotif({ orderId, serviceName, countryName, phoneNumber, price, token }) {
  return (
    `📱 <b>NOMOR OTP TERJUAL</b>\n` +
    `${DIVIDER}\n` +
    `🧾 Order : <code>${orderId}</code>\n` +
    `📦 Layanan : <b>${serviceName || "-"}</b>\n` +
    `🌍 Negara : ${countryName || "-"}\n` +
    `☎️ Nomor : <code>${phoneNumber || "-"}</code>\n` +
    `💵 Harga : <b>${rupiah(price)}</b>\n` +
    `👤 Akun : <code>${maskToken(token)}</code>\n` +
    `🕒 Waktu : ${nowWIB()}` +
    channelFooter()
  );
}

export function otpReceivedNotif({ orderId, serviceName, countryName, phoneNumber, otpCode, token }) {
  return (
    `🔓 <b>KODE OTP DITERIMA</b>\n` +
    `${DIVIDER}\n` +
    `🧾 Order : <code>${orderId}</code>\n` +
    `📦 Layanan : <b>${serviceName || "-"}</b>\n` +
    `🌍 Negara : ${countryName || "-"}\n` +
    `☎️ Nomor : <code>${phoneNumber || "-"}</code>\n` +
    `🔑 Kode OTP : <code>${otpCode}</code>\n` +
    `👤 Akun : <code>${maskToken(token)}</code>\n` +
    `🕒 Waktu : ${nowWIB()}` +
    channelFooter()
  );
}

export function newUserNotif({ token, referredBy }) {
  return (
    `🆕 <b>PENGGUNA BARU</b>\n` +
    `${DIVIDER}\n` +
    `👤 Akun : <code>${maskToken(token)}</code>\n` +
    (referredBy ? `🔗 Diundang oleh : <code>${maskToken(referredBy)}</code>\n` : "") +
    `🕒 Waktu : ${nowWIB()}\n` +
    `Ada user baru terdaftar di website. 🎉` +
    channelFooter()
  );
}

export function otpAutoRefundNotif({ orderId, serviceName, countryName, price, token }) {
  return (
    `↩️ <b>REFUND OTOMATIS</b>\n` +
    `${DIVIDER}\n` +
    `🧾 Order lama : <code>${orderId}</code>\n` +
    `📦 Layanan : <b>${serviceName || "-"}</b>\n` +
    `🌍 Negara : ${countryName || "-"}\n` +
    `💵 Nominal dikembalikan : <b>${rupiah(price)}</b>\n` +
    `👤 Akun : <code>${maskToken(token)}</code>\n` +
    `🕒 Waktu : ${nowWIB()}\n` +
    `Nomor pengganti tidak tersedia dari provider, saldo user dikembalikan otomatis.` +
    channelFooter()
  );
}

export function voucherCreatedNotif({ code, amount, maxUses }) {
  return (
    `🎟️ <b>VOUCHER BARU DIBUAT</b>\n` +
    `${DIVIDER}\n` +
    `🔑 Kode : <code>${code}</code>\n` +
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
    `🔑 Kode : <code>${code}</code>\n` +
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
    (note ? `📝 Catatan : ${note}\n` : "") +
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
    `${message}\n` +
    `🕒 Waktu : ${nowWIB()}` +
    channelFooter()
  );
}

// Notif saat admin membuat pengumuman baru di Pusat Informasi.
export function announcementCreatedNotif({ title, category }) {
  return (
    `📝 <b>PENGUMUMAN BARU DITERBITKAN</b>\n` +
    `${DIVIDER}\n` +
    `Judul : <b>${title}</b>\n` +
    `Kategori : ${category}\n` +
    `🕒 Waktu : ${nowWIB()}` +
    channelFooter()
  );
}

// URL website order nokos — tombol ini otomatis disematkan ke SEMUA notif Telegram di bawah.
const WEB_ORDER_URL = "https://artapedianokosmurahid.vercel.app/";

// Fire-and-forget: sengaja tidak dilempar (throw) ke pemanggil supaya kegagalan
// kirim notif Telegram tidak pernah menggagalkan transaksi deposit/pembelian.
export async function sendTelegramNotif(text) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
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
