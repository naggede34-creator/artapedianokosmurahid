// Notifikasi ke channel/grup Telegram untuk event deposit & pembelian nomor OTP.
// Diam-diam nonaktif kalau TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID belum diisi,
// supaya tidak mengganggu alur utama kalau env belum lengkap.

function maskToken(token = "") {
  if (!token) return "-";
  if (token.length <= 8) return token;
  return `${token.slice(0, 4)}••••${token.slice(-4)}`;
}

function adsFooter() {
  const link = process.env.TELEGRAM_ADS_LINK || "https://t.me/isi_link_kamu_disini";
  const label = process.env.TELEGRAM_ADS_TEXT || "Mau beli nokos kuy? klik di sini";
  return `\n\n🔥 <a href="${link}">${label}</a>`;
}

export function depositPendingNotif({ orderId, amount, token }) {
  return (
    `🟡 <b>Deposit Pending</b>\n` +
    `Order: <code>${orderId}</code>\n` +
    `Nominal: Rp${Number(amount).toLocaleString("id-ID")}\n` +
    `Akun: <code>${maskToken(token)}</code>` +
    adsFooter()
  );
}

export function depositSuccessNotif({ orderId, amount, token, balance }) {
  return (
    `✅ <b>Deposit Berhasil</b>\n` +
    `Order: <code>${orderId}</code>\n` +
    `Nominal: Rp${Number(amount).toLocaleString("id-ID")}\n` +
    `Saldo sekarang: Rp${Number(balance).toLocaleString("id-ID")}\n` +
    `Akun: <code>${maskToken(token)}</code>` +
    adsFooter()
  );
}

export function otpPurchaseNotif({ orderId, serviceName, countryName, phoneNumber, price, token }) {
  return (
    `📱 <b>Nomor OTP Terjual</b>\n` +
    `Order: <code>${orderId}</code>\n` +
    `Layanan: ${serviceName || "-"}\n` +
    `Negara: ${countryName || "-"}\n` +
    `Nomor: <code>${phoneNumber || "-"}</code>\n` +
    `Harga: Rp${Number(price).toLocaleString("id-ID")}\n` +
    `Akun: <code>${maskToken(token)}</code>` +
    adsFooter()
  );
}

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
        disable_web_page_preview: true
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
