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

/**
 * MARKUP DIUBAH — untuk ADMIN SITUS. Bingkai tipis: ini catatan, bukan uang.
 *
 * Markup menentukan harga yang dibayar pembeli di bot itu. Perubahannya perlu
 * ada jejaknya supaya keluhan "harganya naik sendiri" bisa dicocokkan dengan
 * kapan dan oleh bot mana.
 */
export function resellerMarkupNotif({ botUsername, botNama, ownerUsername, lama, baru }) {
  return (
    `📊 <b>MARKUP RESELLER DIUBAH</b>\n` +
    `${identitas({ botUsername, botNama, ownerUsername })}\n${TIPIS}\n\n` +
    `Sebelum ╸ ${Number(lama) || 0}%\n` +
    `Sesudah ╸ <b>${Number(baru) || 0}%</b>\n\n` +
    `<i>Harga di bot itu ikut berubah untuk pesanan berikutnya.</i>`
  );
}

/**
 * BROADCAST TERKIRIM — untuk ADMIN SITUS. Bingkai tipis.
 *
 * Bukan untuk mengawasi isi pesannya, tapi karena pesan itu keluar lewat
 * infrastruktur situs ini. Kalau suatu hari ada laporan spam dari pengguna
 * bot reseller, ini satu-satunya catatan yang bisa menunjukkan bot mana yang
 * mengirim, berapa banyak, dan kapan.
 */
export function resellerBroadcastNotif({ botUsername, botNama, ownerUsername, terkirim, gagal, cuplikan }) {
  const c = String(cuplikan || "").trim();
  return (
    `📢 <b>BROADCAST RESELLER</b>\n` +
    `${identitas({ botUsername, botNama, ownerUsername })}\n${TIPIS}\n\n` +
    `Terkirim ╸ <b>${Number(terkirim) || 0}</b> chat\n` +
    `Gagal    ╸ ${Number(gagal) || 0}\n\n` +
    `<i>${esc(c.slice(0, 200))}${c.length > 200 ? "…" : ""}</i>`
  );
}

/**
 * PESANAN GAGAL, KOMISI DITARIK — bingkai tebal, karena ini uang berkurang.
 *
 * Wajib ada. Komisinya memang ditarik kembali saat pesanannya refund — itu
 * benar, komisi dari nomor yang tidak jadi dipakai bukan hak siapa pun — tapi
 * tanpa kabar ini angkanya cuma turun sendiri tanpa sebab yang kelihatan, dan
 * resellernya akan mengira sistemnya mencuri.
 */
export function resellerRefundNotif({ botUsername, botNama, ownerUsername, serviceName, countryName, phoneNumber, komisi, harga, sebab }) {
  return (
    `↩️⚠️ <b>PESANAN GAGAL — KOMISI DITARIK</b>\n` +
    `${identitas({ botUsername, botNama, ownerUsername })}\n${TEBAL}\n\n` +
    `<b>− ${rupiah(komisi)}</b>  komisi ditarik kembali\n\n` +
    `Layanan ╸ ${esc(serviceName || "-")}\n` +
    `Negara  ╸ ${esc(countryName || "-")}\n` +
    `Nomor   ╸ <code>${esc(phoneNumber || "-")}</code>\n` +
    `Dibayar ╸ ${rupiah(harga)} — <b>dikembalikan penuh ke pembeli</b>\n\n` +
    `Sebab ╸ ${esc(sebab || "Nomor tidak menerima kode OTP.")}\n\n` +
    `${TEBAL}\n<i>Pembelinya tidak jadi memakai nomornya, jadi tidak ada yang dibayar ke siapa pun. Bukan potongan, cuma dikembalikan ke keadaan semula.</i>`
  );
}

/**
 * PENARIKAN DIAJUKAN — untuk ADMIN SITUS, bukan untuk resellernya.
 *
 * Penarikan itu uang keluar, dan dikerjakan manual. Tanpa notifikasi ini,
 * pengajuan cuma duduk di tab admin sampai ada yang kebetulan membukanya —
 * sementara resellernya sudah melihat komisinya berkurang dan menunggu.
 *
 * Nomor e-walletnya ikut karena admin memang harus mengirim ke situ, dan
 * itulah persis sebabnya notif ini TIDAK PERNAH boleh ke channel.
 */
export function resellerWdBaruNotif({ botUsername, botNama, ownerUsername, pemilikToken, amount, biaya, diterima, ewalletNama, nomor, atasNama, sisaKomisi, wdId }) {
  return (
    `🏦⏳ <b>PENARIKAN KOMISI DIAJUKAN</b>\n` +
    `${identitas({ botUsername, botNama, ownerUsername })}\n${TEBAL}\n\n` +
    `<b>${rupiah(diterima)}</b>  ← yang harus dikirim\n\n` +
    `Diminta  ╸ ${rupiah(amount)}\n` +
    `Biaya    ╸ ${rupiah(biaya)}\n` +
    `Ke       ╸ ${esc(ewalletNama)}\n` +
    `Nomor    ╸ <code>${esc(nomor)}</code>\n` +
    `Atas nama╸ ${esc(atasNama || "-")}\n\n` +
    `Sisa komisi ╸ ${rupiah(sisaKomisi)}\n` +
    `Kode akun   ╸ <code>${esc(pemilikToken || "-")}</code>\n` +
    `ID tarik    ╸ <code>${esc(wdId)}</code>\n\n` +
    `${TEBAL}\n<i>Proses di dasbor admin → tab Bot Reseller → Penarikan.</i>`
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
