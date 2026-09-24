// Semua tautan resmi Arta Pedia, di satu tempat.
//
// Sebelumnya tautan channel ditulis ulang di tujuh berkas berbeda. Saat
// channelnya pindah, tujuh-tujuhnya harus dicari satu per satu — dan yang
// terlewat tidak menimbulkan error apa pun, cuma tombol yang diam-diam
// mengarah ke tempat lama. Sekarang satu berkas ini yang menentukan.

/** Channel pengumuman transaksi. Semua notif publik masuk ke sini. */
export const CHANNEL_URL = "https://t.me/artapediaaaa";

/**
 * ID channel untuk API Telegram.
 *
 * CATATAN PENTING soal urutan: nilai di panel admin (settings.telegramChannelId)
 * menimpa yang ini. Kalau notif tidak muncul di channel yang benar, yang perlu
 * diperiksa lebih dulu adalah isi kolom "Telegram Channel ID" di panel admin,
 * bukan berkas ini — di panel itu ada tombol untuk mengembalikannya ke nilai di
 * bawah dalam sekali klik.
 */
export const CHANNEL_ID = "-1004438772298";

/**
 * Daftar channel Telegram (addlist) — semua channel info & promo sekaligus.
 * Berbeda dari CHANNEL_URL yang cuma satu channel notifikasi transaksi.
 */
export const CHANNEL_LIST_URL = "https://t.me/addlist/xu-SAob9aMk3YTI9";

/** Bot toko. Dipakai tombol "ORDER VIA BOT". */
export const BOT_URL = "https://t.me/artapediaofcidbot";

/**
 * Alamat situs, dipakai di contoh dokumentasi API QRIS Gateway.
 *
 * Ditulis penuh dan bukan diambil dari window.location: dokumentasinya dibaca
 * untuk DISALIN ke server merchant, dan alamat yang ikut berubah mengikuti
 * tempat halamannya dibuka akan menghasilkan contoh yang menunjuk ke localhost
 * saat dibaca dari komputer pengembangnya sendiri.
 */
export const SITE_URL = "https://artapedianokosmurahid.vercel.app";

/** Mini app di dalam bot. Dipakai tombol "ORDER VIA WEB". */
export const WEBAPP_URL = "https://t.me/artapediaofcidbot/artapediaidnokos";

/**
 * Dua tombol yang menempel di SETIAP notif channel.
 *
 * Notif yang bagus tanpa tombol tetap berakhir jadi bacaan saja: orang yang
 * tertarik harus keluar dari channel, mencari botnya, lalu mulai dari nol —
 * dan sebagian besar tidak. Dua tombol ini memotong seluruh langkah itu.
 */
export function tombolOrder() {
  return [
    [
      { text: "🤖 ORDER VIA BOT", url: BOT_URL },
      { text: "🌐 ORDER VIA WEB", url: WEBAPP_URL }
    ]
  ];
}
