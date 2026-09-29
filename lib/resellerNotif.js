// Notifikasi seputar bot reseller.
//
// Sengaja terpisah dari lib/telegram.js: notifikasi di sini menyebut kode akun
// pemilik bot, dan itu kredensial. Dengan berkas sendiri, ia tidak bisa tidak
// sengaja ikut terkirim ke channel publik lewat pemanggilan yang salah.
//
// ─────────────────────────────────────────────────────────────────────────
// TIAP JENIS PUNYA BENTUKNYA SENDIRI
//
// Bingkai, ikon, dan susunannya berbeda per kejadian. Bukan demi variasi:
// pemilik bot membaca notifikasi ini sambil lalu, di antara puluhan chat lain.
// Kalau semuanya berbentuk sama, ia harus MEMBACA untuk tahu ini kabar apa —
// dan yang dibaca sambil lalu biasanya tidak dibaca.
//
// Yang paling penting dibedakan: uang masuk (deposit, penjualan) dari sekadar
// kabar (pembeli baru, OTP sampai). Dua yang pertama berbingkai tebal dengan
// nominal berdiri sendiri; dua yang terakhir berbingkai tipis.
// ─────────────────────────────────────────────────────────────────────────
import { esc, rupiah } from "@/lib/shopBot";

const TEBAL = "━━━━━━━━━━━━━━━━━━━━";
const TIPIS = "┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈";

/**
 * Identitas botnya, dipasang di SETIAP notif.
 *
 * Nama bot DAN pemiliknya ikut. Pemilik yang punya tiga bot menerima
 * notifikasi yang kalau tidak dibedakan akan terbaca sama persis — dan
 * notifikasi yang tidak bisa dibedakan sama saja dengan tidak ada. Nama
 * ownernya ikut karena bot reseller bisa dipegang bersama, dan yang membaca
 * perlu tahu ini bot siapa.
 */
function identitas({ botUsername, botNama, ownerUsername }) {
  const baris = [`🤖 <b>@${esc(botUsername || "-")}</b>`];
  if (botNama) baris.push(`<i>${esc(botNama)}</i>`);
  baris.push(`👤 Owner: ${ownerUsername ? "@" + esc(ownerUsername) : "—"}`);
  return baris.join("\n");
}

/** Ada pengguna membuat bot reseller baru. HANYA untuk admin situs. */
export function botResellerBaruNotif({ username, nama, ownerUsername, ownerTelegramId, markupPersen, pemilikToken, pemilikNama }) {
  return (
    `🎉🤖 <b>BOT RESELLER BARU</b> 🤖🎉\n${TEBAL}\n\n` +
    `Bot        ╸ @${esc(username)}\n` +
    `Nama bot   ╸ ${esc(nama || "-")}\n` +
    `Owner TG   ╸ @${esc(ownerUsername || "-")} (<code>${esc(ownerTelegramId || "-")}</code>)\n` +
    `Markup     ╸ ${Number(markupPersen) || 0}%\n\n` +
    `Pemilik    ╸ ${esc(pemilikNama || "tanpa nama")}\n` +
    `Kode akun  ╸ <code>${esc(pemilikToken)}</code>\n\n` +
    `${TEBAL}\n<i>Kelola semua bot pengguna di dasbor admin → tab Bot Reseller.</i>`
  );
}

/** PEMBELI BARU — bingkai tipis, kabar ringan. */
export function resellerUserBaruNotif({ botUsername, botNama, ownerUsername, chatId, username, totalPembeli }) {
  return (
    `👋 <b>PEMBELI BARU</b>\n` +
    `${identitas({ botUsername, botNama, ownerUsername })}\n${TIPIS}\n\n` +
    `Telegram ╸ ${username ? "@" + esc(username) : "tanpa username"}\n` +
    `Chat ID  ╸ <code>${esc(chatId)}</code>\n\n` +
    `Sekarang ada <b>${totalPembeli}</b> orang yang pernah membuka botmu.`
  );
}

/** DEPOSIT — bingkai tebal, nominal berdiri sendiri. Ini uang masuk. */
export function resellerDepositNotif({ botUsername, botNama, ownerUsername, status, amount, metode, chatId, username }) {
  const sukses = status === "sukses";
  return (
    `${sukses ? "💵✅" : "⏳"} <b>${sukses ? "DEPOSIT MASUK" : "DEPOSIT MENUNGGU"}</b>\n` +
    `${identitas({ botUsername, botNama, ownerUsername })}\n${TEBAL}\n\n` +
    `<b>${rupiah(amount)}</b>\n\n` +
    `Metode  ╸ ${esc(metode || "-")}\n` +
    `Pembeli ╸ ${username ? "@" + esc(username) : `<code>${esc(chatId)}</code>`}\n\n` +
    `${TEBAL}\n` +
    (sukses
      ? `<i>Saldonya sudah masuk. Pembeli bisa langsung order.</i>`
      : `<i>Menunggu dibayar. Kalau tidak dibayar, batal sendiri.</i>`)
  );
}

/** NOKOS TERJUAL — bingkai tebal, komisinya yang paling menonjol. */
export function resellerBeliNotif({ botUsername, botNama, ownerUsername, serviceName, countryName, phoneNumber, harga, komisi, username }) {
  return (
    `🛒💰 <b>NOKOS TERJUAL</b>\n` +
    `${identitas({ botUsername, botNama, ownerUsername })}\n${TEBAL}\n\n` +
    `<b>+ ${rupiah(komisi)}</b>  komisi buat kamu\n\n` +
    `Layanan ╸ ${esc(serviceName || "-")}\n` +
    `Negara  ╸ ${esc(countryName || "-")}\n` +
    `Nomor   ╸ <code>${esc(phoneNumber || "-")}</code>\n` +
    `Dibayar ╸ ${rupiah(harga)}\n` +
    `Pembeli ╸ ${username ? "@" + esc(username) : "-"}\n\n` +
    `${TEBAL}\n<i>Komisi bisa ditarik mulai Rp15.000 lewat Menu Admin Reseller.</i>`
  );
}

/** OTP DITERIMA — bingkai tipis, kabar bahwa pesanannya sampai. */
export function resellerOtpNotif({ botUsername, botNama, ownerUsername, serviceName, phoneNumber, username }) {
  return (
    `🎉 <b>KODE OTP SAMPAI</b>\n` +
    `${identitas({ botUsername, botNama, ownerUsername })}\n${TIPIS}\n\n` +
    `Layanan ╸ ${esc(serviceName || "-")}\n` +
    `Nomor   ╸ <code>${esc(phoneNumber || "-")}</code>\n` +
    `Pembeli ╸ ${username ? "@" + esc(username) : "-"}\n\n` +
    // Kode OTP-nya sendiri TIDAK ikut. Itu milik pembelinya, dan pemilik bot
    // tidak perlu bisa membaca kode masuk ke akun orang lain.
    `<i>Pesanannya berhasil. Kodenya hanya dikirim ke pembelinya.</i>`
  );
}

/** PENARIKAN DIPROSES — kabar dari admin situs ke pemilik bot. */
export function resellerWdSelesaiNotif({ botUsername, botNama, ownerUsername, diterima, ewalletNama, nomor }) {
  return (
    `🏦✅ <b>PENARIKAN DIKIRIM</b>\n` +
    `${identitas({ botUsername, botNama, ownerUsername })}\n${TEBAL}\n\n` +
    `<b>${rupiah(diterima)}</b>\n\n` +
    `Ke      ╸ ${esc(ewalletNama)}\n` +
    `Nomor   ╸ <code>${esc(nomor)}</code>\n\n` +
    `${TEBAL}\n<i>Cek e-walletmu. Kalau belum masuk dalam 1x24 jam, hubungi admin.</i>`
  );
}

export function resellerWdTolakNotif({ botUsername, botNama, ownerUsername, amount, alasan }) {
  return (
    `🏦❌ <b>PENARIKAN DITOLAK</b>\n` +
    `${identitas({ botUsername, botNama, ownerUsername })}\n${TEBAL}\n\n` +
    `<b>${rupiah(amount)}</b> dikembalikan penuh ke komisimu.\n\n` +
    `Alasan ╸ ${esc(alasan || "tidak disebutkan")}\n\n` +
    `${TEBAL}\n<i>Biaya adminnya ikut dikembalikan — uangnya tidak jadi dikirim.</i>`
  );
}
