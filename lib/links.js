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

/** Bot toko. Dipakai tombol "ORDER VIA BOT". */
export const BOT_URL = "https://t.me/artapediaofcidbot";

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
