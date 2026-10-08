import { cfg } from "@/lib/config";
import { kirimRich, perkayaSemua } from "@/lib/rich";
// Bot Telegram khusus OWNER: kontrol saldo user & lihat statistik lewat chat,
// terpisah dari lib/telegram.js yang isinya notifikasi satu arah ke channel.
// Endpoint webhook-nya ada di app/api/telegram/webhook/route.js

const API_BASE = "https://api.telegram.org";

async function botToken() {
  return (await cfg("TELEGRAM_BOT_TOKEN"));
}

export async function ownerIds() {
  return ((await cfg("TELEGRAM_OWNER_IDS")) || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function isOwner(chatId) {
  return (await ownerIds()).includes(String(chatId));
}

export function rupiah(n) {
  return `Rp${Number(n || 0).toLocaleString("id-ID")}`;
}

export async function sendMessage(chatId, text) {
  const token = (await botToken());
  if (!token) {
    console.warn("[telegramBot] TELEGRAM_BOT_TOKEN belum diset.");
    return;
  }
  const panggil = async (metode, badan) => {
    try {
      const res = await fetch(`${API_BASE}/bot${token}/${metode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(badan)
      });
      const data = await res.json().catch(() => null);
      if (!data?.ok) console.error(`[telegramBot] Gagal kirim pesan (${metode}):`, res.status, data?.description || "");
      return data;
    } catch (err) {
      console.error("[telegramBot] Gagal kirim pesan:", err?.message || err);
      return null;
    }
  };
  // Panel owner juga rich; kalau ditolak jatuh ke teks biasa.
  const aktif = (await cfg("RICH_MESSAGE")) !== "0";
  const pesan = aktif ? perkayaSemua(text) : null;
  if (pesan) {
    await kirimRich(panggil, { chatId, pesan, aktif });
    return;
  }
  await panggil("sendMessage", { chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true });
}

export const HELP_TEXT =
  `<b>🤖 Panel Owner</b>\n\n` +
  `/addsaldo <code>TOKEN NOMINAL</code> — tambah saldo user\n` +
  `/kurangisaldo <code>TOKEN NOMINAL</code> — kurangi saldo user\n` +
  `/cekuser <code>TOKEN</code> — lihat detail 1 user\n` +
  `/listuser <code>[halaman]</code> — daftar user terbaru (10/halaman)\n` +
  `/statistik — ringkasan total user, saldo & referral\n` +
  `/statuswarungnokos — cek koneksi & saldo WarungNokos\n\n` +
  `<b>Bot Toko</b> (bot pembeli, token terpisah)\n` +
  `/linkwebhook — tampilkan alamat webhook bot toko\n` +
  `/pasangwebhook — pasang webhook bot toko sekarang\n` +
  `/cekwebhook — cek webhook bot toko terpasang atau belum\n` +
  `/lepaswebhook — lepas webhook bot toko\n` +
  `/diagnosabot — cari sebab webhook hilang sendiri\n\n` +
  `/help — tampilkan menu ini lagi\n\n` +
  `Contoh: <code>/addsaldo AP-1234-ABCD-5678 10000</code>`;
