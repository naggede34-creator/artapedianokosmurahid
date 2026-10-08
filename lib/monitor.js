import { cfg } from "@/lib/config";
import { adalahRich, kirimRich, perkayaSemua } from "@/lib/rich";
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
  const botToken = (await cfg("TELEGRAM_BOT_TOKEN"));
  const chatId = (await cfg("TELEGRAM_MONITOR_CHAT_ID")) || "@diskusiduniotp";
  const threadId = (await cfg("TELEGRAM_MONITOR_THREAD_ID")) || "2949";
  if (!botToken) return;

  // message_thread_id cuma valid untuk grup forum/topik. Kalau dikosongkan
  // (mis. mau kirim ke chat biasa tanpa topik), field ini dilewati saja.
  const ekstra = threadId ? { message_thread_id: Number(threadId) } : {};

  // Pemanggil API sendiri, dengan batas waktu: log monitor tidak boleh
  // menahan fungsi yang memanggilnya.
  const panggil = async (metode, badan) => {
    try {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/${metode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(12000),
        body: JSON.stringify(badan)
      });
      const data = await res.json().catch(() => null);
      if (!data?.ok) console.error(`Gagal kirim monitor log Telegram (${metode}):`, data?.description || res.status);
      return data;
    } catch (err) {
      console.error("Gagal kirim monitor log Telegram:", err?.message || err);
      return null;
    }
  };

  const aktif = (await cfg("RICH_MESSAGE")) !== "0";
  const pesan = adalahRich(text) ? text : aktif ? perkayaSemua(text) : null;
  if (pesan) {
    await kirimRich(panggil, { chatId, pesan, aktif, ekstra });
    return;
  }
  await panggil("sendMessage", { chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true, ...ekstra });
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
    `${allOk ? "✅" : "⚠️"} <b>LAPORAN CRON</b>\n` +
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
