// Isi awal popup "Yang Baru". Dipakai sebagai cadangan saat admin belum pernah
// mengubah apa pun, dan sebagai benih daftar saat tab Pembaruan pertama dibuka.
export const JUDUL_BAWAAN = "✨ Yang Baru di Artapedia";
export const SUB_BAWAAN = "Banyak fitur baru sudah aktif. Ini ringkasannya.";
export const VERSI_BAWAAN = "2026-10-08a";

export const ITEM_BAWAAN = [
  {
    ikon: "🧧", judul: "BARU: Saldo Kaget — bagi saldo, siapa cepat dia dapat", baru: true,
    isi: "Buat paket Kaget: tentukan total saldo dan jumlah penerima, pilih dibagi acak atau rata, lalu bagikan satu tautan. Tiap akun hanya bisa klaim sekali, penerima dengan bagian terbesar diberi label \"Paling beruntung\", dan sisa yang tak terklaim kembali otomatis ke saldomu saat paket berakhir.",
    href: "/kaget", tombol: "Buka Saldo Kaget"
  },
  {
    ikon: "🏦", judul: "BARU: QRIS Gateway lewat AustinPay + tarik otomatis", baru: true,
    isi: "Terima pembayaran QRIS dari pelanggan tokomu sendiri lewat API, dan tarik saldo gateway ke e-wallet secara otomatis (minimal Rp10.000, biaya Rp1.000). Tombolnya ada di bilah atas, tepat di samping Beranda.",
    href: "/gateway", tombol: "Buka QRIS Gateway"
  },
  {
    ikon: "🎁", judul: "BARU: Cashback bertingkat — makin sering belanja, makin besar", baru: true,
    isi: "Cashback deposit kini naik sesuai tingkatmu (Bronze–Platinum, dari total belanja nokos) dan ada tambahan untuk deposit besar. Lihat persen persisnya, simulasi per nominal, dan progres ke tingkat berikutnya di halaman Cashback.",
    href: "/cashback", tombol: "Lihat cashback"
  },
  {
    ikon: "🎨", judul: "7 Gaya Tampilan + Skin Kostum Maskot (gratis)", baru: true,
    isi: "Pilih gaya web sesukamu di menu Tampilan: Komik 3D (bawaan), Liquid, Glass, Neon, Clay, Bersih, atau Retro. Maskot elang juga punya skin kostum (Emas, Es, Api, Hantu, Sakura) — plus kostum musiman (Natal, Ramadan, 17 Agustus, Pesta) yang otomatis dipakai saat eventnya berlangsung.",
    href: "/tampilan", tombol: "Atur tampilan"
  },
  {
    ikon: "🎉", judul: "Event Musiman Otomatis — diskon & cashback",
    isi: "Tanggal kembar (1.1 – 12.12), hari gajian, Ramadan, Lebaran, Natal, 17 Agustus, dan lainnya jalan sendiri sesuai kalender: banner + hitung mundur, diskon harga nokos, bonus cashback deposit, dan tema khusus.",
    href: "/dashboard", tombol: "Lihat event"
  },
  {
    ikon: "💬", judul: "WEARTA CHAT — chat ala WhatsApp",
    isi: "Chat pribadi & grup, kirim foto, pesan suara, stiker, jajak pendapat; balas, reaksi, teruskan, ubah & hapus pesan; centang dibaca, online/terakhir dilihat, dan indikator mengetik. Ada juga WEARTA AI: awali pesan dengan @ai untuk memanggilnya.",
    href: "/chat", tombol: "Buka WEARTA CHAT"
  },
  {
    ikon: "📞", judul: "Panggilan suara & video + Status (SW)",
    isi: "Telepon teman langsung dari web. Buat status teks/foto yang hilang setelah 24 jam, dan lihat siapa saja yang menontonnya."
  },
  {
    ikon: "🎖", judul: "Lencana verifikasi berwarna",
    isi: "Admin bisa memberi lencana verifikasi dengan pilihan warna: biru, hitam, oranye, pink, hijau, dan lainnya."
  },
  {
    ikon: "👤", judul: "Profil Akun & tombol Keluar",
    isi: "Halaman profil lengkap: avatar, tingkat cashback, statistik, kode akun (sembunyi/salin/unduh), tema, notifikasi, dan Keluar dari akun dengan aman.",
    href: "/profil", tombol: "Buka profil"
  },
  {
    ikon: "🔐", judul: "Daftar & masuk dengan kode akun",
    isi: "Daftar cukup dengan nama — kamu mendapat kode akun untuk masuk lagi kapan saja, juga di bot Telegram."
  },
  {
    ikon: "🤖", judul: "Bot Telegram lebih rapi & lengkap",
    isi: "Tampilan Rich Message, tombol berwarna dan tertata rapi, notifikasi lebih detail, plus paket reseller dan program kreator."
  }
];
