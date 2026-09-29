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
import { rupiah } from "@/lib/shopBot";
import { rich } from "@/lib/rich";

// Semua notifikasi di sini dibuat dengan blok rich. Bentuk klasiknya (kalau
// sendRichMessage ditolak) dibuat otomatis dari blok yang sama.
//
// Perbedaan tampilan per jenis tetap dipertahankan, dengan alat yang lebih baik:
//   uang masuk/keluar → heading besar (h1) + tabel + tombol
//   kabar ringan      → heading kecil (h3), tanpa angka besar

/**
 * Identitas botnya, dipasang di SETIAP notif — nama bot DAN pemiliknya.
 * Pemilik yang punya tiga bot menerima notifikasi yang kalau tidak dibedakan
 * akan terbaca sama persis, dan notifikasi yang tidak bisa dibedakan sama saja
 * dengan tidak ada.
 */
function identitas({ botUsername, botNama, ownerUsername }) {
  return {
    table: {
      rows: [
        ["🤖 Bot", [{ b: `@${botUsername || "-"}` }, ...(botNama ? [" · ", { i: botNama }] : [])]],
        ["👤 Owner", ownerUsername ? `@${ownerUsername}` : "—"]
      ]
    }
  };
}

const tanpa = (x) => x.filter(Boolean);

/** Ada pengguna membuat bot reseller baru. HANYA untuk admin situs. */
export function botResellerBaruNotif({ username, nama, ownerUsername, ownerTelegramId, markupPersen, pemilikToken, pemilikNama }) {
  return rich([
    { h2: "🎉🤖 BOT RESELLER BARU" },
    {
      table: {
        rows: [
          ["🤖 Bot", [{ b: `@${username}` }]],
          ["📛 Nama bot", nama || "-"],
          ["👤 Owner TG", [`@${ownerUsername || "-"} (`, { code: ownerTelegramId || "-" }, ")"]],
          ["📊 Markup", `${Number(markupPersen) || 0}%`],
          ["🙋 Pemilik", pemilikNama || "tanpa nama"],
          // Kode akun = kredensial. Sebab notif ini hanya boleh ke admin.
          ["🔑 Kode akun", [{ code: pemilikToken }]]
        ]
      }
    },
    { hr: true },
    { footer: "Kelola semua bot pengguna di dasbor admin → tab Bot Reseller." }
  ]);
}

/** PEMBELI BARU — kabar ringan: heading kecil, tanpa angka besar. */
export function resellerUserBaruNotif({ botUsername, botNama, ownerUsername, chatId, username, totalPembeli }) {
  return rich([
    { h3: "👋 PEMBELI BARU" },
    identitas({ botUsername, botNama, ownerUsername }),
    {
      table: {
        rows: [
          ["📨 Telegram", username ? `@${username}` : "tanpa username"],
          ["🆔 Chat ID", [{ code: chatId }]]
        ]
      }
    },
    { p: ["Sekarang ada ", { b: String(totalPembeli) }, " orang yang pernah membuka botmu."] }
  ]);
}

/** DEPOSIT — uang masuk: angka besar. */
export function resellerDepositNotif({ botUsername, botNama, ownerUsername, status, amount, metode, chatId, username }) {
  const sukses = status === "sukses";
  return rich([
    { h2: sukses ? "💵✅ DEPOSIT MASUK" : "⏳ DEPOSIT MENUNGGU" },
    identitas({ botUsername, botNama, ownerUsername }),
    { h1: rupiah(amount) },
    { table: { rows: [["💳 Metode", metode || "-"], ["🙋 Pembeli", username ? `@${username}` : [{ code: chatId }]]] } },
    { hr: true },
    { footer: sukses ? "Saldonya sudah masuk. Pembeli bisa langsung order." : "Menunggu dibayar. Kalau tidak dibayar, batal sendiri." }
  ]);
}

/** NOKOS TERJUAL — komisinya yang paling menonjol. */
export function resellerBeliNotif({ botUsername, botNama, ownerUsername, serviceName, countryName, phoneNumber, harga, komisi, username }) {
  return rich([
    { h2: "🛒💰 NOKOS TERJUAL" },
    identitas({ botUsername, botNama, ownerUsername }),
    { h1: `+ ${rupiah(komisi)}` },
    { p: [{ i: "komisi buat kamu" }] },
    {
      table: {
        rows: [
          ["🏷️ Layanan", serviceName || "-"],
          ["🌍 Negara", countryName || "-"],
          ["☎️ Nomor", [{ code: phoneNumber || "-" }]],
          ["💵 Dibayar", rupiah(harga)],
          ["🙋 Pembeli", username ? `@${username}` : "-"]
        ]
      }
    },
    { hr: true },
    { footer: "Komisi bisa ditarik mulai Rp15.000 lewat Menu Admin Reseller." }
  ]);
}

/** OTP DITERIMA — kabar ringan bahwa pesanannya sampai. */
export function resellerOtpNotif({ botUsername, botNama, ownerUsername, serviceName, phoneNumber, username }) {
  return rich([
    { h3: "🎉 KODE OTP SAMPAI" },
    identitas({ botUsername, botNama, ownerUsername }),
    { table: { rows: [["🏷️ Layanan", serviceName || "-"], ["☎️ Nomor", [{ code: phoneNumber || "-" }]], ["🙋 Pembeli", username ? `@${username}` : "-"]] } },
    // Kode OTP-nya sendiri TIDAK ikut. Itu milik pembelinya, dan pemilik bot
    // tidak perlu bisa membaca kode masuk ke akun orang lain.
    { footer: "Pesanannya berhasil. Kodenya hanya dikirim ke pembelinya." }
  ]);
}

/** PENARIKAN DIKIRIM — kabar dari admin situs ke pemilik bot. */
export function resellerWdSelesaiNotif({ botUsername, botNama, ownerUsername, diterima, ewalletNama, nomor }) {
  return rich([
    { h2: "🏦✅ PENARIKAN DIKIRIM" },
    identitas({ botUsername, botNama, ownerUsername }),
    { h1: rupiah(diterima) },
    { table: { rows: [["📲 Ke", ewalletNama], ["🔢 Nomor", [{ code: nomor }]]] } },
    { hr: true },
    { footer: "Cek e-walletmu. Kalau belum masuk dalam 1x24 jam, hubungi admin." }
  ]);
}

export function resellerWdTolakNotif({ botUsername, botNama, ownerUsername, amount, alasan }) {
  return rich([
    { h2: "🏦❌ PENARIKAN DITOLAK" },
    identitas({ botUsername, botNama, ownerUsername }),
    { h1: rupiah(amount) },
    { p: [{ i: "dikembalikan penuh ke komisimu" }] },
    { table: { rows: [["📝 Alasan", alasan || "tidak disebutkan"]] } },
    { hr: true },
    { footer: "Biaya adminnya ikut dikembalikan — uangnya tidak jadi dikirim." }
  ]);
}

/** BOT DIMATIKAN ADMIN — kabar ke pemilik bot, lewat botnya sendiri. */
export function resellerDimatikanNotif({ botUsername, botNama, ownerUsername }) {
  return rich([
    { h2: "⛔ BOTMU DIMATIKAN ADMIN" },
    identitas({ botUsername, botNama, ownerUsername }),
    { p: ["Bot ini berhenti melayani pembeli. Komisi yang sudah terkumpul ", { b: "tidak dihapus" }, "."] },
    { hr: true },
    { footer: "Hubungi admin kalau merasa ini keliru." }
  ]);
}

/** BOT DINYALAKAN ADMIN — kabar ke pemilik bot. */
export function resellerDinyalakanNotif({ botUsername, botNama, ownerUsername }) {
  return rich([
    { h3: "✅ BOTMU DINYALAKAN KEMBALI" },
    identitas({ botUsername, botNama, ownerUsername }),
    { p: "Bot ini aktif lagi dan sudah bisa melayani pembeli." }
  ]);
}

/** MARKUP DIUBAH — untuk ADMIN SITUS. Kabar ringan: ini catatan, bukan uang. */
export function resellerMarkupNotif({ botUsername, botNama, ownerUsername, lama, baru }) {
  return rich([
    { h3: "📊 MARKUP RESELLER DIUBAH" },
    identitas({ botUsername, botNama, ownerUsername }),
    { table: { rows: [["Sebelum", `${Number(lama) || 0}%`], ["Sesudah", [{ b: `${Number(baru) || 0}%` }]]] } },
    { footer: "Harga di bot itu ikut berubah untuk pesanan berikutnya." }
  ]);
}

/** BROADCAST TERKIRIM — untuk ADMIN SITUS. Satu-satunya catatan kalau ada laporan spam. */
export function resellerBroadcastNotif({ botUsername, botNama, ownerUsername, terkirim, gagal, cuplikan }) {
  const c = String(cuplikan || "").trim();
  return rich([
    { h3: "📢 BROADCAST RESELLER" },
    identitas({ botUsername, botNama, ownerUsername }),
    { table: { rows: [["📤 Terkirim", [{ b: `${Number(terkirim) || 0} chat` }]], ["⚠️ Gagal", String(Number(gagal) || 0)]] } },
    ...tanpa([c ? { blockquote: { text: c.slice(0, 200) + (c.length > 200 ? "…" : "") } } : null])
  ]);
}

/** PESANAN GAGAL, KOMISI DITARIK — uang berkurang: angka besar. */
export function resellerRefundNotif({ botUsername, botNama, ownerUsername, serviceName, countryName, phoneNumber, komisi, harga, sebab }) {
  return rich([
    { h2: "↩️⚠️ PESANAN GAGAL — KOMISI DITARIK" },
    identitas({ botUsername, botNama, ownerUsername }),
    { h1: `− ${rupiah(komisi)}` },
    { p: [{ i: "komisi ditarik kembali" }] },
    {
      table: {
        rows: [
          ["🏷️ Layanan", serviceName || "-"],
          ["🌍 Negara", countryName || "-"],
          ["☎️ Nomor", [{ code: phoneNumber || "-" }]],
          ["💵 Dibayar", `${rupiah(harga)} — dikembalikan penuh ke pembeli`],
          ["📝 Sebab", sebab || "Nomor tidak menerima kode OTP."]
        ]
      }
    },
    { hr: true },
    { footer: "Pembelinya tidak jadi memakai nomornya, jadi tidak ada yang dibayar ke siapa pun. Bukan potongan, cuma dikembalikan ke keadaan semula." }
  ]);
}

/** PENARIKAN DIAJUKAN — untuk ADMIN SITUS. Memuat nomor e-wallet: TIDAK PERNAH ke channel. */
export function resellerWdBaruNotif({ botUsername, botNama, ownerUsername, pemilikToken, amount, biaya, diterima, ewalletNama, nomor, atasNama, sisaKomisi, wdId }) {
  return rich([
    { h2: "🏦⏳ PENARIKAN KOMISI DIAJUKAN" },
    identitas({ botUsername, botNama, ownerUsername }),
    { h1: rupiah(diterima) },
    { p: [{ i: "yang harus dikirim" }] },
    {
      table: {
        rows: [
          ["💵 Diminta", rupiah(amount)],
          ["➖ Biaya", rupiah(biaya)],
          ["📲 Ke", ewalletNama],
          ["🔢 Nomor", [{ code: nomor }]],
          ["🙋 Atas nama", atasNama || "-"],
          ["🏦 Sisa komisi", rupiah(sisaKomisi)],
          ["🔑 Kode akun", [{ code: pemilikToken || "-" }]],
          ["🆔 ID tarik", [{ code: wdId }]]
        ]
      }
    },
    { hr: true },
    { footer: "Proses di dasbor admin → tab Bot Reseller → Penarikan." }
  ]);
}
