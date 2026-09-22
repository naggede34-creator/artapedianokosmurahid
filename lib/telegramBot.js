// Bot Telegram khusus OWNER: kontrol saldo user & lihat statistik lewat chat,
// terpisah dari lib/telegram.js yang isinya notifikasi satu arah ke channel.
// Endpoint webhook-nya ada di app/api/telegram/webhook/route.js

const API_BASE = "https://api.telegram.org";

function botToken() {
  return process.env.TELEGRAM_BOT_TOKEN;
}

export function ownerIds() {
  return (process.env.TELEGRAM_OWNER_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isOwner(chatId) {
  return ownerIds().includes(String(chatId));
}

export function rupiah(n) {
  return `Rp${Number(n || 0).toLocaleString("id-ID")}`;
}

export async function sendMessage(chatId, text) {
  const token = botToken();
  if (!token) {
    console.warn("[telegramBot] TELEGRAM_BOT_TOKEN belum diset.");
    return;
  }
  try {
    const res = await fetch(`${API_BASE}/bot${token}/sendMessage`, {
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
      console.error("[telegramBot] Gagal kirim pesan:", res.status, errBody);
    }
  } catch (err) {
    console.error("[telegramBot] Gagal kirim pesan:", err?.message || err);
  }
}

export const HELP_TEXT =
  `<b>🤖 Panel Owner Artapedia</b>\n\n` +
  `/addsaldo <code>TOKEN NOMINAL</code> — tambah saldo user\n` +
  `/kurangisaldo <code>TOKEN NOMINAL</code> — kurangi saldo user\n` +
  `/cekuser <code>TOKEN</code> — lihat detail 1 user\n` +
  `/listuser <code>[halaman]</code> — daftar user terbaru (10/halaman)\n` +
  `/statistik — ringkasan total user, saldo & referral\n` +
  `/statuswarungnokos — cek koneksi & saldo WarungNokos\n` +
  `/help — tampilkan menu ini lagi\n\n` +
  `Contoh: <code>/addsaldo AP-1234-ABCD-5678 10000</code>`;
