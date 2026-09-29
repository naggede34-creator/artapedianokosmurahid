// Mengirim notifikasi ke pemilik bot reseller, lewat botnya sendiri.
//
// Kenapa lewat botnya sendiri dan bukan bot utama: pemilik bot mungkin tidak
// pernah memulai bot utama, dan Telegram menolak pesan ke orang yang belum
// pernah memulai bot itu. Notifnya akan hilang tanpa error — justru di kabar
// yang paling ditunggu.
import { jalankanDenganBot } from "@/lib/botContext";
import { sendMessage } from "@/lib/shopBot";
import { botsCol } from "@/lib/db";
import { SITE_URL } from "@/lib/links";

/**
 * Kirim teks ke pemilik bot. Tidak pernah melempar: notifikasi yang gagal
 * tidak boleh menggagalkan transaksi yang sudah berhasil.
 */
export async function kabariPemilikBot(bot, teks, keyboard = null) {
  try {
    if (!bot?.token || !bot?.ownerTelegramId) return;
    // Tanpa keyboard khusus, tiap notif membawa dua tombol berwarna: buka
    // botnya (biru) dan panel reseller di web (hijau) — pemilik biasanya ingin
    // langsung mengecek botnya atau komisinya setelah membaca kabar.
    const papan =
      keyboard ||
      [
        [
          ...(bot.username ? [{ text: "🤖 Buka Bot", url: `https://t.me/${String(bot.username).replace(/^@/, "")}`, style: "primary" }] : []),
          { text: "🏪 Panel Reseller", url: `${SITE_URL}/reseller`, style: "success" }
        ]
      ];
    await jalankanDenganBot(
      { botId: bot.botId, token: bot.token, username: bot.username, jenis: "reseller" },
      () => sendMessage(bot.ownerTelegramId, teks, papan)
    );
  } catch (err) {
    console.error("[reseller] notif pemilik gagal:", err?.message || err);
  }
}

/** Dokumen bot reseller yang sedang aktif di konteks, atau null. */
export async function botResellerSekarang(botAktifObj) {
  if (botAktifObj?.jenis !== "reseller" || !botAktifObj?.botId) return null;
  try {
    const col = await botsCol();
    return await col.findOne({ botId: String(botAktifObj.botId) });
  } catch {
    return null;
  }
}

/** Menaikkan hitungan pembeli bot ini, sekali per chat. */
export async function catatPembeliBaru(botId, chatId) {
  if (!botId || !chatId) return { baru: false, total: 0 };
  try {
    const col = await botsCol();
    // $addToSet: chat yang sama tidak dihitung dua kali walau menekan /start
    // berkali-kali. Tanpa itu, "jumlah pembeli" cuma menghitung berapa kali
    // tombol start ditekan, dan angkanya tidak berarti apa-apa.
    const sebelum = await col.findOne({ botId: String(botId) }, { projection: { pembeliIds: 1 } });
    const sudahAda = (sebelum?.pembeliIds || []).includes(String(chatId));
    if (sudahAda) return { baru: false, total: (sebelum.pembeliIds || []).length };

    const sesudah = await col.findOneAndUpdate(
      { botId: String(botId) },
      { $addToSet: { pembeliIds: String(chatId) }, $inc: { jumlahPembeli: 1 } },
      { returnDocument: "after" }
    );
    return { baru: true, total: (sesudah?.pembeliIds || []).length };
  } catch (err) {
    console.error("[reseller] catat pembeli gagal:", err?.message || err);
    return { baru: false, total: 0 };
  }
}
