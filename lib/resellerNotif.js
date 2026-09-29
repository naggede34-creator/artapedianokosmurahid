// Notifikasi seputar bot reseller.
//
// Sengaja terpisah dari lib/telegram.js: notifikasi di sini menyebut kode akun
// pemilik bot, dan itu kredensial. Dengan berkas sendiri, ia tidak bisa tidak
// sengaja ikut terkirim ke channel publik lewat pemanggilan yang salah.
import { esc, rupiah } from "@/lib/shopBot";

const RULE = "━━━━━━━━━━━━━━━━━━━";

/** Ada pengguna membuat bot reseller baru. HANYA untuk admin. */
export function botResellerBaruNotif({ username, nama, ownerUsername, ownerTelegramId, markupPersen, pemilikToken, pemilikNama }) {
  return (
    `🤖  <b>BOT RESELLER BARU</b>\n${RULE}\n\n` +
    `Bot        ╸ @${esc(username)}\n` +
    `Nama bot   ╸ ${esc(nama || "-")}\n` +
    `Owner TG   ╸ @${esc(ownerUsername || "-")} (<code>${esc(ownerTelegramId || "-")}</code>)\n` +
    `Markup     ╸ ${Number(markupPersen) || 0}%\n\n` +
    `Pemilik    ╸ ${esc(pemilikNama || "tanpa nama")}\n` +
    `Kode akun  ╸ <code>${esc(pemilikToken)}</code>\n\n` +
    `<i>Kelola semua bot pengguna di dasbor admin → tab Bot Telegram.</i>`
  );
}

/**
 * Kejadian di dalam SATU bot reseller.
 *
 * Nama botnya selalu ikut di judul. Tanpa itu, pemilik yang punya tiga bot
 * melihat deretan notifikasi yang sama persis dan tidak tahu yang mana —
 * notifikasi yang tidak bisa dibedakan sama saja dengan tidak ada.
 */
function kepala(ikon, judul, botUsername) {
  return `${ikon}  <b>${judul}</b>\n<i>via @${esc(botUsername)}</i>\n${RULE}\n\n`;
}

export function resellerUserBaruNotif({ botUsername, chatId, username, totalPembeli }) {
  return (
    kepala("👋", "PEMBELI BARU", botUsername) +
    `Telegram ╸ ${username ? "@" + esc(username) : "tanpa username"}\n` +
    `Chat ID  ╸ <code>${esc(chatId)}</code>\n` +
    `Total    ╸ ${totalPembeli} pembeli di bot ini\n`
  );
}

export function resellerDepositNotif({ botUsername, status, amount, metode, chatId, username }) {
  const ikon = status === "sukses" ? "✅" : "⏳";
  const judul = status === "sukses" ? "DEPOSIT MASUK" : "DEPOSIT MENUNGGU";
  return (
    kepala(ikon, judul, botUsername) +
    `Nominal ╸ <b>${rupiah(amount)}</b>\n` +
    `Metode  ╸ ${esc(metode || "-")}\n` +
    `Pembeli ╸ ${username ? "@" + esc(username) : `<code>${esc(chatId)}</code>`}\n`
  );
}

export function resellerBeliNotif({ botUsername, serviceName, countryName, phoneNumber, harga, komisi, username }) {
  return (
    kepala("🛒", "NOKOS TERJUAL", botUsername) +
    `Layanan ╸ ${esc(serviceName || "-")}\n` +
    `Negara  ╸ ${esc(countryName || "-")}\n` +
    `Nomor   ╸ <code>${esc(phoneNumber || "-")}</code>\n` +
    `Harga   ╸ <b>${rupiah(harga)}</b>\n` +
    `Komisi  ╸ <b>${rupiah(komisi)}</b> masuk ke kamu\n` +
    `Pembeli ╸ ${username ? "@" + esc(username) : "-"}\n`
  );
}

export function resellerOtpNotif({ botUsername, serviceName, phoneNumber, username }) {
  return (
    kepala("🎉", "KODE OTP DITERIMA", botUsername) +
    `Layanan ╸ ${esc(serviceName || "-")}\n` +
    `Nomor   ╸ <code>${esc(phoneNumber || "-")}</code>\n` +
    `Pembeli ╸ ${username ? "@" + esc(username) : "-"}\n\n` +
    // Kode OTP-nya sendiri TIDAK ikut. Itu milik pembelinya, dan pemilik bot
    // tidak perlu bisa membaca kode masuk ke akun orang lain.
    `<i>Kode OTP-nya hanya dikirim ke pembelinya.</i>`
  );
}
