// Log aktivitas pengguna & monitoring layanan — dikirim ke thread/topik Telegram
// KHUSUS (terpisah dari TELEGRAM_CHAT_ID yang dipakai untuk notif transaksi/admin),
// supaya log teknis tidak bercampur dengan notif bisnis di channel utama.
//
// Target defaultnya thread "Log Aktivitas & Monitoring" di grup @diskusiduniotp
// (https://t.me/diskusiduniotp/2949) — bisa dioverride lewat env kalau perlu pindah.
// Diam-diam nonaktif kalau TELEGRAM_BOT_TOKEN belum diisi.

function nowWIB() {
  return (
    new Date().toLocaleString("id-ID", {
      timeZone: "Asia/Jakarta",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }) + " WIB"
  );
}

export async function sendMonitorLog(text) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_MONITOR_CHAT_ID || "@diskusiduniotp";
  const threadId = process.env.TELEGRAM_MONITOR_THREAD_ID || "2949";
  if (!botToken) return;

  try {
    const body = {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true
    };
    // message_thread_id cuma valid untuk grup forum/topik. Kalau env-nya dikosongkan
    // (mis. mau kirim ke chat biasa tanpa topik), field ini dilewati saja.
    if (threadId) body.message_thread_id = Number(threadId);

    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.error("Gagal kirim monitor log Telegram:", res.status, errBody);
    }
  } catch (err) {
    console.error("Gagal kirim monitor log Telegram:", err?.message || err);
  }
}

function maskToken(token = "") {
  if (!token) return "-";
  if (token.length <= 8) return token;
  return `${token.slice(0, 4)}••••${token.slice(-4)}`;
}

const DIVIDER = "┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈";

export function userLoginLog({ token, isNew }) {
  return (
    `${isNew ? "🆕 <b>USER BARU REGISTER</b>" : "👤 <b>USER LOGIN</b>"}\n` +
    `${DIVIDER}\n` +
    `🔑 Akun : <code>${maskToken(token)}</code>\n` +
    `🕒 Waktu : ${nowWIB()}`
  );
}

export function adminLoginLog({ success, ip }) {
  return (
    `${success ? "🛡️ <b>ADMIN LOGIN BERHASIL</b>" : "⚠️ <b>PERCOBAAN LOGIN ADMIN GAGAL</b>"}\n` +
    `${DIVIDER}\n` +
    (ip ? `🌐 IP : <code>${ip}</code>\n` : "") +
    `🕒 Waktu : ${nowWIB()}`
  );
}

export function cronReportLog({ health, cleanup }) {
  const healthLines = health
    .map((h) => `${h.ok ? (h.error ? "🟠" : "✅") : "❌"} ${escHtml(h.name)}${h.ms !== undefined ? ` (${h.ms}ms)` : ""}${h.error ? ` — ${escHtml(h.error)}` : ""}`)
    .join("\n");
  return (
    `🧹 <b>LAPORAN CRON 5 MENIT</b>\n` +
    `${DIVIDER}\n` +
    `<b>Status layanan:</b>\n${healthLines}\n` +
    `${DIVIDER}\n` +
    `<b>Pembersihan MongoDB:</b>\n` +
    `🔁 Pesanan OTP pending kedaluwarsa direkonsiliasi : ${cleanup.otpReconciled}\n` +
    `💸 ...dari situ ke-refund otomatis : ${cleanup.otpRefunded}\n` +
    `💳 Deposit dicek ulang : ${cleanup.depositsChecked ?? 0} (dikredit telat: ${cleanup.depositsCredited ?? 0})\n` +
    `🚀 Suntik sosmed disinkron : ${cleanup.smmSynced ?? 0} (selesai: ${cleanup.smmSettled ?? 0})\n` +
    `🗑️ Deposit gagal/kedaluwarsa (>24 jam) dihapus : ${cleanup.depositsDeleted}\n` +
    `🗑️ Broadcast lama/nonaktif dihapus : ${cleanup.broadcastsDeleted}\n` +
    (cleanup.errors?.length ? `${DIVIDER}\n⚠️ Error: ${cleanup.errors.slice(0, 5).map(escHtml).join(" | ")}\n` : "") +
    `${DIVIDER}\n` +
    `🕒 ${nowWIB()}`
  );
}

function escHtml(v) {
  return String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
