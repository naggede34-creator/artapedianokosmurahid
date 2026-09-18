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
  const allOk = health.every((h) => h.ok && !h.error);
  const healthLines = health
    .map((h) => {
      const icon = h.ok ? (h.error ? "🟠" : "✅") : "❌";
      const ms = h.ms !== undefined ? ` <i>(${h.ms}ms)</i>` : "";
      const err = h.error ? ` — <b>${escHtml(h.error)}</b>` : "";
      return `${icon} ${escHtml(h.name)}${ms}${err}`;
    })
    .join("\n");

  const hasCleanup =
    (cleanup.otpRefunded ?? 0) + (cleanup.depositsCredited ?? 0) +
    (cleanup.depositsDeleted ?? 0) + (cleanup.broadcastsDeleted ?? 0) +
    (cleanup.notifDeleted ?? 0) + (cleanup.scratchDeleted ?? 0) > 0;

  return (
    `${allOk ? "✅" : "⚠️"} <b>LAPORAN CRON ARTAPEDIA</b>\n` +
    `${DIVIDER}\n` +
    `📡 <b>Status Layanan:</b>\n${healthLines}\n` +
    `${DIVIDER}\n` +
    `🧹 <b>Auto-Clean MongoDB:</b>\n` +
    `🔁 OTP pending kedaluwarsa direkonsiliasi : ${cleanup.otpReconciled ?? 0}\n` +
    `💸 ...dari situ ke-refund otomatis       : ${cleanup.otpRefunded ?? 0}\n` +
    `💳 Deposit dicek ulang                   : ${cleanup.depositsChecked ?? 0} (kredit: ${cleanup.depositsCredited ?? 0})\n` +
    `🗑️ Deposit lama dihapus                  : ${cleanup.depositsDeleted ?? 0}\n` +
    `🗑️ Broadcast lama dihapus                : ${cleanup.broadcastsDeleted ?? 0}\n` +
    `🔔 Notif lama dihapus                    : ${cleanup.notifDeleted ?? 0}\n` +
    `🎫 Scratch card lama dihapus             : ${cleanup.scratchDeleted ?? 0}\n` +
    (cleanup.errors?.length
      ? `${DIVIDER}\n⚠️ Error: ${cleanup.errors.slice(0, 5).map(escHtml).join(" | ")}\n`
      : !hasCleanup ? `ℹ️ Tidak ada sampah ditemukan\n` : "") +
    `${DIVIDER}\n` +
    `🕒 ${nowWIB()}`
  );
}

export function securityScanLog({ flagged, autoSuspended, flags }) {
  if (flagged === 0) {
    return `🛡️ Security scan bersih — ${nowWIB()}`;
  }
  const lines = (flags || []).slice(0, 8).map((f) => {
    const icon = f.severity === "critical" ? "🚨" : f.severity === "high" ? "🔴" : "🟡";
    return `${icon} <code>${f.token}</code> — ${escHtml(f.reason)}`;
  }).join("\n");
  return (
    `🛡️ <b>SECURITY SCAN — ${flagged} FLAG</b>\n` +
    `${DIVIDER}\n` +
    `${lines}\n` +
    `${DIVIDER}\n` +
    `🚫 Auto-suspend: <b>${autoSuspended}</b> akun\n` +
    `🕒 ${nowWIB()}`
  );
}

function escHtml(v) {
  return String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
