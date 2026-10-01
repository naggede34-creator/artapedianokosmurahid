// Isi awal popup "Yang Baru". Dipakai sebagai cadangan saat admin belum pernah
// mengubah apa pun, dan sebagai benih daftar saat tab Pembaruan pertama dibuka.
export const JUDUL_BAWAAN = "✨ Yang Baru di Artapedia";
export const SUB_BAWAAN = "Banyak fitur baru sudah aktif. Ini ringkasannya.";
export const VERSI_BAWAAN = "2026-10-01d";

export const ITEM_BAWAAN = [
  {
    ikon: "🎨", judul: "BARU: 7 Gaya Tampilan + Skin Kostum Maskot", baru: true,
    isi: "Pilih gaya web sesukamu di menu Tampilan: Komik 3D (bawaan), Liquid, Glass, Neon, Clay, Bersih, atau Retro. Maskot elang juga punya skin kostum (Emas, Es, Api, Hantu, Sakura) yang dibeli pakai poin toko — plus kostum musiman (Natal, Ramadan, 17 Agustus, Pesta) yang otomatis dipakai saat eventnya berlangsung.",
    href: "/tampilan", tombol: "Atur tampilan"
  },
  {
    ikon: "🎉", judul: "BARU: Event Musiman Otomatis — diskon & cashback", baru: true,
    isi: "Tanggal kembar (1.1 – 12.12), hari gajian, Ramadan, Lebaran, Natal, 17 Agustus, dan lainnya kini jalan sendiri sesuai kalender: banner + hitung mundur, diskon harga nokos, bonus cashback deposit, dan tema khusus. Pantau banner di beranda!",
    href: "/dashboard", tombol: "Lihat event"
  },
  {
    ikon: "👑", judul: "BARU: Season Arena & Turnamen Mingguan", baru: true,
    isi: "Duel Arena Pendekar kini punya peringkat musim (rating ELO, tingkat Perunggu–Legenda) dan turnamen mingguan. Juara musim & pekan mendapat hadiah otomatis ke Saldo Game. Buka Arena Pendekar → Season & Turnamen.",
    href: "/chat?game=tarung", tombol: "Lihat peringkat"
  },
  {
    ikon: "🛡", judul: "BARU: Klan — tim, grup chat & misi bersama", baru: true,
    isi: "Buat atau gabung klan: dapat grup WEARTA CHAT khusus, misi mingguan bersama (menang duel, beli OTP, deposit) dengan hadiah poin toko, dan papan peringkat klan.",
    href: "/klan", tombol: "Buka Klan"
  },
  {
    ikon: "📸", judul: "BARU: Bagikan Kemenangan + Pita \"Baru Saja\" + WEARTA AI melayang", baru: true,
    isi: "Menang duel? Bagikan kartu kemenangan ke Status WEARTA atau Telegram. Di beranda ada pita bukti sosial \"baru saja beli / menang\" (nama disamarkan). Dan WEARTA AI kini melayang di semua halaman: menjawab dan mengarahkanmu ke menu yang tepat.",
    href: "/dashboard", tombol: "Coba sekarang"
  },
  {
    ikon: "⚡", judul: "BARU: QRIS FAST + Tarik Saldo Otomatis", baru: true,
    isi: "Metode deposit QRIS FAST — super cepat, saldo & poin game masuk otomatis begitu dibayar (tanpa bukti transfer). Kini saldo nokos bisa ditarik ke e-wallet (DANA, GoPay, ShopeePay, dll.) secara otomatis: minimal Rp10.000, biaya admin Rp2.000, maksimal 5× per hari. Poin game juga bisa ditarik otomatis (minimal Rp15.000, biaya Rp2.000). Hanya saldo hasil deposit yang bisa ditarik.",
    href: "/tarik", tombol: "Tarik saldo"
  },
  {
    ikon: "✦", judul: "BARU: WEARTA AI — asisten pintar di WEARTA CHAT", baru: true,
    isi: "Seperti Meta AI di WhatsApp: obrolan WEARTA AI selalu ada di paling atas daftar chat. Tanya cara deposit, beli nomor OTP, poin game, minta dibuatkan caption atau terjemahan. Di chat mana pun, awali pesan dengan @ai untuk memanggilnya. Kini WEARTA CHAT juga bisa kirim dokumen (PDF, Word, Excel, ZIP), kirim lokasi, teks tebal/miring/coret ala WhatsApp, dan ganti latar obrolan.",
    href: "/chat", tombol: "Ngobrol dengan AI"
  },
  {
    ikon: "🥋", judul: "BARU: Arena Pendekar — game tarung arkade 1 lawan 1", baru: true,
    isi: "Pilih 5 petarung (Rakun, Ninja Bayangan, Beruang Raksasa, Ninja Es, Rubah Api) dengan jurus & pamungkas berbeda. Main solo melawan CPU (Arkade 4 penantang, Tarung Cepat 3 tingkat kesulitan, Latihan) dengan tombol sentuh, combo, tangkis sempurna, musik & efek tarung — atau duel lawan pengguna lain dengan pilihan aksi rahasia tiap giliran (bisa taruhan poin).",
    href: "/chat?game=tarung", tombol: "Masuk arena"
  },
  {
    ikon: "🎲", judul: "Saldo Game jadi Poin Game — bisa ditukar & ditarik", baru: true,
    isi: "Game kini memakai POIN (2 poin = Rp1.000), terpisah dari saldo nokos. Isi poin lewat QRIS manual (bukti dibaca otomatis) atau dari saldo nokos, tukar poin ke saldo nokos, atau tarik ke e-wallet (DANA, OVO, GoPay, ShopeePay, LinkAja) minimal Rp10.000 — diproses maksimal 1–2 hari kerja sesuai jam kerja admin. Biaya tarik 4 poin per pengajuan.",
    href: "/game-deposit", tombol: "Buka Poin Game"
  },
  {
    ikon: "🎰", judul: "5 Game Solo bermusik — Plinko, Mahjong Ways, Dadu Naga, Keno & Roda Hoki", baru: true,
    isi: "Kini ada 5 game solo dengan musik santai ala kasino dan efek suara (bisa dimatikan lewat 🎵/🔊): Plinko, Mahjong Spin 1024 (ubin asli, naga emas, putaran gratis), Dadu Naga (atur peluang sendiri), Keno Hoki (pilih hingga 10 angka), dan Roda Hoki (3 tingkat risiko). Semua memakai poin game utamamu dengan RTP ≈ 96%.",
    href: "/chat?game=1", tombol: "Coba sekarang"
  },
  {
    ikon: "🎮", judul: "6 Duel Game — Arena Pendekar, UNO, Remi, Mahjong, Catur & Domino Gaple", baru: true,
    isi: "Main lawan sesama pengguna, lengkap dengan taruhan poin (potongan admin tampil jelas) dan Domino Gaple yang baru. Demi keamanan: duel bertaruhan tidak bisa diserahkan di awal permainan, dan sistem anti-curang otomatis membekukan akun ganda pada satu perangkat serta duel antar-akun yang mencurigakan.",
    href: "/chat?game=1", tombol: "Main sekarang"
  },
  {
    ikon: "💬", judul: "WEARTA CHAT — chat ala WhatsApp", baru: true,
    isi: "Chat pribadi & grup, kirim foto, pesan suara, stiker, jajak pendapat; balas, reaksi, teruskan, ubah & hapus pesan; centang dibaca, online/terakhir dilihat, dan indikator mengetik. Pesan sementara, arsip, bisukan, dan blokir juga ada."
  },
  {
    ikon: "📞", judul: "Panggilan suara & video + Status (SW)", baru: true,
    isi: "Telepon teman langsung dari web. Buat status teks/foto yang hilang setelah 24 jam, dan lihat siapa saja yang menontonnya."
  },
  {
    ikon: "🎖", judul: "Lencana verifikasi berwarna",
    isi: "Admin bisa memberi lencana verifikasi dengan pilihan warna: biru, hitam, oranye, pink, hijau, dan lainnya."
  },
  {
    ikon: "🔗", judul: "Bagikan kontak lewat tautan",
    isi: "Kontak dibagikan sebagai tautan yang langsung membuka chat — tanpa membagikan kode akun. Sebelum mengobrol, kamu wajib mengatur nama dulu."
  },
  {
    ikon: "👤", judul: "Profil Akun & tombol Keluar",
    isi: "Halaman profil lengkap: avatar, level, statistik, kode akun (sembunyi/salin/unduh), tema, notifikasi, dan Keluar dari akun dengan aman.",
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
