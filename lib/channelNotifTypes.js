// Daftar jenis kejadian yang BOLEH diumumkan ke channel Telegram.
//
// Dipisah dari lib/notifyHub.js supaya halaman admin (komponen klien) bisa
// menampilkan daftarnya tanpa ikut menarik koneksi database dan token bot ke
// dalam bundel peramban.
//
// ATURAN KERAS: ini DAFTAR PUTIH, bukan daftar larangan. Channel adalah tempat
// terbuka — siapa pun yang punya tautannya bisa membaca seluruh isinya. Jenis
// yang tidak terdaftar di sini tidak akan pernah sampai ke sana. Jadi kalau
// suatu hari ada jenis notif baru yang lupa didaftarkan, akibatnya adalah ia
// tidak diumumkan; bukan bocornya saldo, nama asli, nomor rekening, atau kode
// OTP orang ke publik. Itu arah kegagalan yang benar, dan itu disengaja.
//
// Yang SENGAJA TIDAK ADA di sini, dan tidak boleh ditambahkan:
//   - penarikan saldo admin (nominal kas toko bukan urusan pembaca channel)
//   - penyesuaian saldo/poin oleh admin
//   - deposit manual yang menunggu dicek (memuat bukti transfer)
//   - peringatan provider & hasil pindai keamanan (peta masalah untuk penyerang)
//   - suspend/blokir pengguna
//
// key: { label untuk panel admin, bawaan nyala/mati, pin di channel }
export const DAFTAR_PUBLIK = {
  giveaway_baru: {
    label: "Giveaway dibuka",
    catatan: "Judul, hadiah, kuota, dan jam tutupnya. Tidak ada data pribadi.",
    bawaan: true,
    pin: true
  },
  giveaway_menang: {
    label: "Pemenang giveaway",
    catatan: "Nama tampilan pemenang; kode akunnya disamarkan.",
    bawaan: true,
    pin: true
  },
  deposit_sukses: {
    label: "Deposit berhasil",
    catatan: "Metode, nominal, lama proses, kode akun disamarkan.",
    bawaan: true,
    pin: true
  },
  deposit_pending: {
    label: "Deposit menunggu pembayaran",
    catatan: "Metode & nominal saja — menunjukkan antrean yang jalan. Kode QRIS-nya tidak pernah ikut.",
    bawaan: true,
    pin: false
  },
  deposit_batal: {
    label: "Deposit batal / kedaluwarsa",
    catatan: "Hanya metode & nominal. Berguna kalau ingin channel terlihat sibuk, tapi bisa terbaca sebagai kegagalan.",
    bawaan: false,
    pin: false
  },
  otp_terjual: {
    label: "Nomor OTP terjual",
    catatan: "Layanan, negara, harga. Nomor disamarkan, nama & saldo tidak ikut.",
    bawaan: true,
    pin: false
  },
  otp_masuk: {
    label: "Kode OTP diterima",
    catatan: "TANPA kode OTP-nya — kode itu milik pembeli yang membayarnya.",
    bawaan: true,
    pin: true
  },
  otp_refund: {
    label: "Refund otomatis",
    catatan: "Bukti bahwa saldo kembali sendiri kalau kode tidak masuk.",
    bawaan: true,
    pin: false
  },
  duel_mulai: {
    label: "Duel permainan dimulai",
    catatan: "Permainan, nama tampilan kedua pemain, dan nominal taruhan. Tanpa kode akun.",
    bawaan: true,
    pin: false
  },
  duel_selesai: {
    label: "Hasil duel permainan",
    catatan: "Pemenang/seri, permainan, nama tampilan, dan nominal. Tanpa kode akun.",
    bawaan: true,
    pin: false
  },
  transfer: {
    label: "Transfer saldo antar pengguna",
    catatan: "Hanya nominal — kode akun pengirim & penerima tidak ikut sama sekali.",
    bawaan: false,
    pin: false
  },
  voucher: {
    label: "Voucher ditebus",
    catatan: "Tanpa kode vouchernya: voucher bersisa akan langsung ditebus pembaca pertama.",
    bawaan: true,
    pin: false
  },
  garansi: {
    label: "Klaim garansi disetujui",
    catatan: "Hanya yang disetujui. Penolakan tidak pernah diumumkan.",
    bawaan: true,
    pin: false
  },
  user_baru: { label: "Pengguna baru bergabung", catatan: "Kode akun disamarkan.", bawaan: true, pin: false },
  juara: { label: "Pemenang Pembeli Terbanyak", catatan: "Pengumuman mingguan, dipin.", bawaan: true, pin: true },
  stok: { label: "Laporan stok & harga", catatan: "Dikirim manual dari tab Stok atau lewat cron.", bawaan: true, pin: false },
  pengumuman: {
    label: "Pengumuman baru",
    catatan: "Judul & kategorinya. Isi lengkapnya tetap dibaca di Pusat Informasi.",
    bawaan: true,
    pin: true
  },
  giveaway_penuh: {
    label: "Kuota giveaway penuh",
    catatan: "Judul & jumlah kursinya. Dikirim sekali saja, saat kursi terakhir terisi.",
    bawaan: true,
    pin: false
  },
  giveaway_batal: {
    label: "Giveaway dibatalkan",
    catatan: "Judul & jumlah peserta. Perlu diumumkan supaya yang sudah ikut tidak menunggu undian yang tidak akan datang.",
    bawaan: true,
    pin: false
  },
  referral: {
    label: "Bonus undang teman cair",
    catatan: "Nominal bonusnya saja; kode akun pengundang disamarkan dan yang diundang tidak ikut sama sekali.",
    bawaan: true,
    pin: false
  },
  saldo_kembali: {
    label: "Saldo tertahan dikembalikan otomatis",
    catatan:
      "Bukti bahwa saldo yang tersangkut di order gagal kembali sendiri tanpa perlu lapor. Nominal & kode akun disamarkan; jenis pesanannya tidak ikut.",
    bawaan: true,
    pin: false
  },
  voucher_baru: {
    label: "Voucher baru dibagikan",
    catatan:
      "BESERTA kodenya — ini memang bagi-bagi voucher. Siapa pun yang membaca channel bisa langsung menebusnya sampai kuotanya habis. Nyalakan hanya untuk voucher yang memang diniatkan untuk umum.",
    bawaan: false,
    pin: true
  }
};

export function channelDefaults() {
  return Object.fromEntries(Object.entries(DAFTAR_PUBLIK).map(([k, v]) => [k, v.bawaan]));
}

/** Nyala/mati satu jenis menurut pengaturan admin; bawaan dipakai kalau belum pernah diatur. */
export function channelAktifUntuk(settings, jenis) {
  if (!DAFTAR_PUBLIK[jenis]) return false;
  const cfg = settings?.channelNotif || {};
  return cfg[jenis] === undefined ? DAFTAR_PUBLIK[jenis].bawaan : Boolean(cfg[jenis]);
}
