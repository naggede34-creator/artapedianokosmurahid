// Isi awal popup "Yang Baru". Dipakai sebagai cadangan saat admin belum pernah
// mengubah apa pun, dan sebagai benih daftar saat tab Pembaruan pertama dibuka.
export const JUDUL_BAWAAN = "✨ Yang Baru di Artapedia";
export const SUB_BAWAAN = "Banyak fitur baru sudah aktif. Ini ringkasannya.";
export const VERSI_BAWAAN = "2026-10-01a";

export const ITEM_BAWAAN = [
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
