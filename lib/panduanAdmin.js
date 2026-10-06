// Panduan tiap tab dasbor admin: fungsinya apa, harus diisi apa, contohnya.
//
// Dipisah dari komponen supaya (1) menambah/mengubah penjelasan tidak perlu
// menyentuh dasbor yang sudah 7.000 baris, dan (2) berkas ini tidak mengimpor
// apa pun — aman dibawa ke bundel peramban.
//
// Bentuk tiap entri:
//   judul   nama tab seperti yang dilihat admin
//   ringkas satu-dua kalimat: tab ini untuk apa
//   item[]  satu per fungsi/isian:
//             nama     nama kartu / kolom di layar
//             fungsi   apa yang terjadi kalau diisi/ditekan
//             isi      harus diisi apa (format, satuan)
//             contoh   contoh isian (opsional)
//             catatan  peringatan / hal yang sering salah (opsional)
//
// Isian API key, token, dan angka batas lain ada di tab Konfigurasi — di sana
// tiap kolom sudah punya penjelasannya sendiri (lib/configRegistry.js).

export const PANDUAN = {
  ringkasan: {
    judul: "Ringkasan",
    ringkas: "Gambaran cepat kondisi toko. Tidak ada yang perlu diisi di sini — halaman ini hanya untuk dibaca.",
    item: [
      { nama: "Kartu angka di atas", fungsi: "Total pengguna, total saldo yang beredar, status website (Online/Maintenance), dan jumlah klaim garansi yang menunggu.", isi: "Tidak ada isian." },
      { nama: "Statistik 7 Hari Terakhir", fungsi: "Grafik/angka pesanan, deposit, dan pendapatan seminggu terakhir.", isi: "Tidak ada isian.", catatan: "Kalau angkanya terlihat aneh, buka tab Transaksi atau Tools → Export Data untuk memeriksa rinciannya." }
    ]
  },

  pengguna: {
    judul: "Pengguna",
    ringkas: "Mengatur saldo dan poin pengguna secara manual, mencari akun, dan melihat log aktivitas.",
    item: [
      { nama: "Tambah / Kurangi Saldo", fungsi: "Mengubah saldo satu akun langsung (mis. mengganti rugi, koreksi salah deposit).", isi: "Kode akun user, nominal Rupiah (angka positif = tambah, negatif = kurangi), dan catatan alasan.", contoh: "Kode akun: a1b2c3… · Nominal: 5000 · Catatan: ganti rugi order gagal", catatan: "Tercatat di riwayat saldo pengguna. Pastikan kode akun benar — salah kode berarti saldo orang lain yang berubah." },
      { nama: "Tambah / Kurangi Poin", fungsi: "Mengubah poin loyalitas satu akun.", isi: "Kode akun user, jumlah poin (negatif untuk mengurangi), catatan.", contoh: "Jumlah: 100 · Catatan: hadiah event" },
      { nama: "Cari kode akun / Filter token", fungsi: "Mencari pengguna di daftar.", isi: "Ketik sebagian nama atau kode akun.", catatan: "Kode akun (token) ada di halaman profil pengguna dan di setiap notifikasi admin." },
      { nama: "Daftar User & Log Aktivitas", fungsi: "Melihat semua pengguna dan riwayat tindakan mereka.", isi: "Tidak ada isian." }
    ]
  },

  konten: {
    judul: "Konten",
    ringkas: "Teks dan tampilan yang dilihat pengguna: chat, broadcast, pusat informasi, voucher, dan karakter hero di beranda.",
    item: [
      { nama: "WEARTA CHAT — Pesan saat ditutup", fungsi: "Kalimat yang dilihat pengguna ketika chat ditutup admin.", isi: "Teks maksimal 200 huruf. Kosong = kalimat bawaan.", contoh: "Chat ditutup untuk perbaikan, kembali jam 09.00." },
      { nama: "Broadcast (Banner Mengambang)", fungsi: "Pengumuman singkat yang melayang di atas halaman untuk semua pengguna.", isi: "Isi pesan; opsional jam 'Mulai tampil' dan 'Berhenti tampil' agar tayang otomatis sesuai jadwal.", catatan: "Matikan atau hapus broadcast lama dari daftar supaya tidak menumpuk." },
      { nama: "Kelola Informasi (Pusat Informasi)", fungsi: "Artikel/pengumuman yang tersimpan di Pusat Informasi.", isi: "Judul pengumuman dan isi pengumuman." },
      { nama: "Voucher Saldo", fungsi: "Membuat kode yang bisa ditukar pengguna menjadi saldo.", isi: "Kode (kosongkan = dibuat otomatis), nominal saldo per klaim (Rupiah), kuota berapa orang boleh klaim.", contoh: "Kode: HUT1 · Nominal: 2000 · Kuota: 50", catatan: "Total saldo yang keluar = nominal × kuota. Hitung dulu sebelum membuat." },
      { nama: "Hero Panel Karakter (Beranda)", fungsi: "Karakter animasi di bagian atas beranda beserta ucapannya.", isi: "Emoji (atau foto), nama, warna accent & glow (kode hex seperti #818cf8), subtitle maks 80 huruf, dialog maks 200 huruf.", catatan: "Maksimal 6 karakter. Panel bisa dimatikan tanpa menghapus daftarnya." }
    ]
  },

  banner: {
    judul: "Banner",
    ringkas: "Gambar promo yang tampil di berbagai halaman web.",
    item: [
      { nama: "Judul *", fungsi: "Nama banner (untuk kamu dan teks alternatif gambar).", isi: "Teks singkat.", contoh: "Promo Nokos Murah" },
      { nama: "Label kecil di banner", fungsi: "Label pojok seperti PROMO atau BARU.", isi: "1–2 kata, boleh kosong.", contoh: "PROMO, BARU, DISKON" },
      { nama: "Gambar banner *", fungsi: "Gambar yang ditampilkan.", isi: "Unggah file gambar ATAU tempel alamat gambar yang diawali https://." },
      { nama: "URL Link (klik banner)", fungsi: "Tujuan saat banner diklik.", isi: "Alamat halaman di web ini (diawali /) atau alamat lengkap https://. Boleh kosong.", contoh: "/otp  atau  https://t.me/channelmu" },
      { nama: "Penempatan *", fungsi: "Di halaman mana banner tampil.", isi: "Pilih satu: Beranda, Halaman Beli Nokos, Halaman Isi Saldo, atau Dashboard User." },
      { nama: "Urutan (sortOrder)", fungsi: "Mengatur urutan kalau satu penempatan punya beberapa banner.", isi: "Angka. Angka kecil tampil lebih dulu.", contoh: "0, 1, 2…" }
    ]
  },

  transaksi: {
    judul: "Transaksi (Flash Sale & Lucky Hours)",
    ringkas: "Diskon berwaktu untuk mendorong pembelian.",
    item: [
      { nama: "Manajemen Flash Sale", fungsi: "Diskon harga nokos yang berlaku selama beberapa jam sejak dibuat.", isi: "Judul flash sale, diskon (%), durasi (jam), dan filter layanan (opsional: kosong = semua layanan).", contoh: "Judul: Flash WA · Diskon: 10 · Durasi: 3 · Filter: wa", catatan: "Diskon langsung memotong margin. Cek markup di Pengaturan Umum sebelum membuat diskon besar." },
      { nama: "Manajemen Lucky Hours", fungsi: "Diskon otomatis yang berulang setiap hari pada jam tertentu.", isi: "Jam mulai dan jam selesai (0–23, WIB), diskon (%), dan label (opsional).", contoh: "Mulai: 20 · Selesai: 22 · Diskon: 5 · Label: Malam Hemat" }
    ]
  },

  depositmanual: {
    judul: "Deposit Manual",
    ringkas: "Antrean pembayaran QRIS manual yang menunggu kamu cek. Saldo masuk hanya setelah kamu menyetujui.",
    item: [
      { nama: "Daftar deposit menunggu", fungsi: "Menampilkan nominal, bukti transfer yang diunggah pengguna, dan waktunya.", isi: "Tidak ada isian — kamu memilih Setujui atau Tolak per baris.", catatan: "Cocokkan nominal DAN nama/waktu di mutasi rekening/e-wallet-mu dengan bukti, jangan hanya percaya gambar." },
      { nama: "Setujui", fungsi: "Menambah saldo pengguna sebesar nominal deposit.", isi: "Opsional catatan.", catatan: "Tidak bisa dibatalkan otomatis. Setujui hanya setelah uangnya benar-benar masuk." },
      { nama: "Tolak", fungsi: "Menutup deposit tanpa menambah saldo.", isi: "Alasan penolakan yang akan dibaca pengguna." },
      { nama: "Pengaturan QRIS manual", fungsi: "Gambar QRIS, atas nama, jam layanan, dan verifikasi otomatis OCR ada di Pengaturan Umum → QRIS Manual.", isi: "Lihat panduan tab Pengaturan Umum." }
    ]
  },

  tarik: {
    judul: "Tarik Saldo (Atlantic)",
    ringkas: "Menarik saldo akun penyedia Atlantic milikmu sendiri ke bank/e-wallet pribadi.",
    item: [
      { nama: "Bank / e-wallet tujuan", fungsi: "Tujuan uang ditransfer.", isi: "Cari dan pilih bank/e-wallet dari daftar, atau ketik kode banknya.", contoh: "BCA, DANA" },
      { nama: "Nomor rekening / HP", fungsi: "Nomor penerima.", isi: "Angka saja, tanpa spasi atau tanda hubung.", contoh: "1234567890", catatan: "Periksa dua kali. Transfer ke nomor yang salah tidak bisa ditarik kembali." },
      { nama: "Nominal (Rp)", fungsi: "Jumlah yang ditarik dari saldo Atlantic.", isi: "Angka Rupiah tanpa titik.", contoh: "100000" },
      { nama: "Catatan (opsional)", fungsi: "Pengingat untuk dirimu di riwayat.", isi: "Teks bebas.", contoh: "tarikan mingguan" }
    ]
  },

  austinpay: {
    judul: "AustinPay",
    ringkas: "Penyedia QRIS FAST dan penarikan otomatis. Di sini kamu mengecek saldo dan mengatur tarik otomatis.",
    item: [
      { nama: "Kunci API", fungsi: "Menunjukkan apakah API key, secret, dan webhook AustinPay sudah terpasang.", isi: "Diisi di tab Konfigurasi (grup Pembayaran QRIS), bukan di sini." },
      { nama: "Pengaturan penarikan otomatis", fungsi: "Mengatur apakah penarikan pengguna dikirim otomatis lewat AustinPay.", isi: "Ikuti petunjuk di kartu itu. Batas nominal dan biaya diatur di Konfigurasi (grup Website)." },
      { nama: "Tarik saldo AustinPay", fungsi: "Memindahkan saldo AustinPay milikmu ke e-wallet/bank pribadi.", isi: "Metode (mis. Dana, BCA), nomor tujuan, nama pemilik, nominal, dan kode admin untuk konfirmasi.", contoh: "Dana · 08123456789 · Nama Pemilik · 100000", catatan: "Periksa nomor tujuan dua kali. Kode admin diminta karena ini memindahkan uang." },
      { nama: "Riwayat & transaksi terbaru", fungsi: "Daftar penarikan otomatis dan transaksi di AustinPay.", isi: "Tidak ada isian." }
    ]
  },

  gateway: {
    judul: "QRIS Gateway",
    ringkas: "Antrean penarikan saldo dari merchant QRIS Gateway. Penarikan TIDAK otomatis: kamu mengirim uangnya sendiri, lalu menandainya.",
    item: [
      { nama: "Filter Menunggu / Selesai / Ditolak / Semua", fungsi: "Memilih daftar penarikan yang ditampilkan.", isi: "Tombol pilihan." },
      { nama: "Salin nomor", fungsi: "Menyalin nomor e-wallet tujuan agar bisa ditempel di aplikasi bank/e-wallet-mu.", isi: "Tombol." },
      { nama: "✅ Sudah Dikirim", fungsi: "Menandai bahwa kamu SUDAH mentransfer uangnya ke merchant.", isi: "Tombol.", catatan: "Saldo merchant sudah dipotong sejak ia mengajukan. Menandai 'sudah dikirim' padahal belum mengirim berarti uang itu hilang dari sisinya." },
      { nama: "❌ Tolak", fungsi: "Menolak penarikan dan mengembalikan saldo merchant penuh, termasuk biaya.", isi: "Alasan penolakan." },
      { nama: "Alamat (Base URL) dokumentasi gateway", fungsi: "Alamat yang dilihat merchant di halaman dokumentasi gateway.", isi: "Diatur di tab Pengaturan Umum → Alamat API (Base URL)." }
    ]
  },

  referral: {
    judul: "Referral",
    ringkas: "Bonus undang teman yang ditahan sistem karena mencurigakan (anti-farming) dan menunggu keputusanmu.",
    item: [
      { nama: "Bonus yang ditahan", fungsi: "Daftar bonus yang melewati batas harian atau terlihat seperti akun palsu.", isi: "Pilih Setujui (bonus cair) atau Tolak.", catatan: "Aturan penahanan (minimal deposit teman, maksimal bonus, maksimal per hari) diatur di tab Konfigurasi grup 'Lainnya'." }
    ]
  },

  kreator: {
    judul: "Kreator (Afiliasi)",
    ringkas: "Program komisi untuk kreator konten yang mempromosikan toko.",
    item: [
      { nama: "Pengajuan menunggu", fungsi: "Orang yang minta menjadi kreator.", isi: "Setujui atau tolak per pengajuan." },
      { nama: "Kreator aktif", fungsi: "Daftar kreator, komisi, dan performa mereka.", isi: "Komisi bawaan diatur di Konfigurasi → AFILIASI_PERSEN (persen dari untung toko)." }
    ]
  },

  lencana: {
    judul: "Lencana",
    ringkas: "Memberi atau mencabut lencana centang verifikasi di WEARTA CHAT.",
    item: [
      { nama: "Cari pengguna", fungsi: "Menemukan akun yang akan diberi lencana.", isi: "Ketik nama, ID publik, atau kode akun (minimal 1 huruf), lalu pilih hasilnya.", contoh: "budi" },
      { nama: "Pemegang lencana", fungsi: "Daftar akun yang saat ini punya lencana.", isi: "Tombol untuk mencabut." }
    ]
  },

  game: {
    judul: "Game",
    ringkas: "Mengatur duel, game solo, dan anti-curang. Saklar utama ada di tab Konfigurasi (grup Website); di sini kamu memantau.",
    item: [
      { nama: "Duel permainan", fungsi: "Status dan pengaturan duel (taruhan, potongan admin).", isi: "Angka batas diatur di Konfigurasi: GAME_TARUHAN_MIN/MAKS, GAME_FEE_PERSEN." },
      { nama: "Game solo (Plinko & Mahjong Spin 1024)", fungsi: "Status game solo dan batasnya.", isi: "Batas taruhan, rugi harian, dan kemenangan maksimal diatur di Konfigurasi (GAME_SOLO_*)." },
      { nama: "Anti-curang game", fungsi: "Deteksi akun ganda dan kolusi duel.", isi: "Saklar di Konfigurasi: GAME_ANTICURANG_AKTIF / _IP / _BAN." },
      { nama: "Duel terbaru", fungsi: "Daftar duel yang baru berlangsung untuk dicek manual.", isi: "Tidak ada isian." }
    ]
  },

  pembaruan: {
    judul: "Pembaruan",
    ringkas: "Popup 'ada fitur baru' yang muncul ke pengguna.",
    item: [
      { nama: "Judul (wajib)", fungsi: "Judul popup.", isi: "Teks singkat.", contoh: "Fitur baru: Duel Catur!" },
      { nama: "Isi pesan", fungsi: "Penjelasan di dalam popup.", isi: "Beberapa kalimat." },
      { nama: "Tautan tombol", fungsi: "Tujuan tombol di popup.", isi: "Alamat halaman di web ini (diawali /) — opsional.", contoh: "/chat?game=1" },
      { nama: "Tulisan tombol", fungsi: "Teks pada tombol.", isi: "Kata kerja pendek.", contoh: "Main sekarang" }
    ]
  },

  musim: {
    judul: "Event Musiman",
    ringkas: "Diskon, cashback, banner, dan tema otomatis mengikuti kalender (Ramadan, 17 Agustus, dll).",
    item: [
      { nama: "Event Musiman Otomatis", fungsi: "Menyalakan/mematikan tiap event bawaan.", isi: "Saklar per event. Batas diskon maksimal diatur di Konfigurasi → MUSIM_DISKON_MAKS." },
      { nama: "Kalender 8 bulan ke depan", fungsi: "Melihat event apa yang akan datang.", isi: "Tidak ada isian." },
      { nama: "Event kustom", fungsi: "Membuat event sendiri, misalnya ulang tahun toko.", isi: "Nama event, tanggal mulai–selesai, diskon (%), bonus cashback (%).", catatan: "Diskon event langsung memotong margin; ingat batas MUSIM_DISKON_MAKS." }
    ]
  },

  tarikpoin: {
    judul: "Poin Game (Penarikan)",
    ringkas: "Antrean penarikan Poin Game ke e-wallet yang menunggu kamu proses.",
    item: [
      { nama: "Daftar pengajuan", fungsi: "Siapa menarik berapa dan ke mana.", isi: "Setujui (setelah uang kamu transfer) atau tolak (poin dikembalikan).", contoh: "Catatan/no. referensi transfer: TRX123456" },
      { nama: "Catatan / no. referensi transfer", fungsi: "Bukti internal bahwa kamu sudah mengirim.", isi: "Nomor referensi dari aplikasi bank/e-wallet — opsional tapi disarankan." },
      { nama: "Pengaturan Poin Game", fungsi: "Minimal tarik, biaya, jam kerja ditampilkan.", isi: "Diatur di Konfigurasi: GAME_TARIK_MIN_RP, GAME_TARIK_FEE_RP, GAME_TARIK_JAM, GAME_TARIK_OTOMATIS." }
    ]
  },

  konfigurasi: {
    judul: "Konfigurasi",
    ringkas: "Satu tempat untuk semua API key, token, dan angka batas. Isi di sini ATAU di Environment Variables hosting — salah satu cukup; kalau dua-duanya terisi, yang dari sini dipakai.",
    item: [
      { nama: "Badge 🌐 Web / ▲ Env / Bawaan / Belum diisi", fungsi: "Menunjukkan nilai sekarang berasal dari mana.", isi: "Tidak ada isian.", catatan: "'Belum diisi' pada API key penyedia berarti fitur penyedia itu belum bisa dipakai." },
      { nama: "Kolom rahasia (API key, token)", fungsi: "Disimpan terenkripsi dan tidak pernah ditampilkan utuh lagi.", isi: "Tempel nilainya, simpan. Kosong = tidak mengubah yang sudah ada.", catatan: "Tiap kolom punya penjelasan sendiri di bawah labelnya: untuk apa, harus diisi apa, dan dapat dari mana." },
      { nama: "Tampilkan pengaturan lanjutan", fungsi: "Memunculkan kolom yang jarang perlu diubah (alamat API penyedia, batas teknis).", isi: "Centang hanya bila kamu tahu yang kamu ubah.", catatan: "Biarkan bawaan kalau ragu." },
      { nama: "Kode admin", fungsi: "Kata sandi masuk ke /admin.", isi: "Kode baru yang panjang dan unik (minimal 8 karakter disarankan).", catatan: "Ganti kode bawaan SEKARANG kalau bar peringatan merah muncul di atas dasbor." },
      { nama: "Diagnosa rute deposit", fungsi: "Menunjukkan penyedia QRIS mana yang siap ikut diacak dan galat terakhirnya.", isi: "Tombol Segarkan." }
    ]
  },

  bot: {
    judul: "Bot Telegram (Toko)",
    ringkas: "Bot tempat pembeli membeli nokos lewat Telegram.",
    item: [
      { nama: "Token bot", fungsi: "Menyambungkan bot Telegram ke toko.", isi: "Token dari @BotFather, bentuknya 1234567890:AAH…", contoh: "1234567890:AAHxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", catatan: "Buat bot baru di @BotFather (/newbot). Jangan bagikan token — siapa pun yang memegangnya mengendalikan bot." },
      { nama: "Bot pertama / Bot tambahan", fungsi: "Daftar bot yang terpasang dan statusnya.", isi: "Tombol pasang ulang webhook bila bot berhenti merespons.", catatan: "Kalau gagal, penyebab paling sering: URL Situs di Pengaturan Umum salah — isi dengan alamat web yang benar-benar bisa dibuka." }
    ]
  },

  reseller: {
    judul: "Bot Reseller",
    ringkas: "Reseller yang berjualan lewat bot mereka sendiri memakai stokmu.",
    item: [
      { nama: "Penarikan Komisi Reseller", fungsi: "Antrean komisi reseller yang minta dicairkan.", isi: "Transfer manual lalu tandai selesai, atau tolak." },
      { nama: "Semua Bot Reseller", fungsi: "Daftar bot reseller, pemilik, dan statusnya.", isi: "Tombol aktif/nonaktifkan.", catatan: "Harga slot, paket Premium, dan level reseller diatur di Konfigurasi grup 'Reseller & kreator'." }
    ]
  },

  giveaway: {
    judul: "Giveaway",
    ringkas: "Undian berhadiah saldo atau poin untuk pengguna.",
    item: [
      { nama: "Judul", fungsi: "Nama giveaway.", isi: "Teks singkat.", contoh: "Giveaway Saldo Akhir Bulan" },
      { nama: "Keterangan (opsional)", fungsi: "Syarat atau cara ikut.", isi: "Teks bebas." },
      { nama: "Jenis hadiah", fungsi: "Hadiah berupa saldo atau poin.", isi: "Pilih Saldo atau Poin." },
      { nama: "Nilai hadiah per pemenang", fungsi: "Besar hadiah tiap pemenang.", isi: "Angka (Rupiah untuk saldo, jumlah untuk poin).", contoh: "5000" },
      { nama: "Jumlah pemenang", fungsi: "Berapa orang yang diundi menang.", isi: "Angka.", catatan: "Total keluar = nilai × jumlah pemenang." },
      { nama: "Maksimal peserta", fungsi: "Batas peserta yang boleh ikut.", isi: "Angka; 0/kosong sesuai petunjuk di kolom." },
      { nama: "Jam mulai / Jam berakhir", fungsi: "Jadwal giveaway.", isi: "Pilih tanggal dan jam." }
    ]
  },

  juara: {
    judul: "Pembeli Terbanyak",
    ringkas: "Papan peringkat pembeli mingguan beserta hadiahnya.",
    item: [
      { nama: "Cairkan hadiah sekarang", fungsi: "Membayar hadiah minggu ini ke para juara tanpa menunggu jadwal otomatis.", isi: "Tombol.", catatan: "Aman ditekan sekali; hadiah yang sudah cair tidak dibayar dua kali." },
      { nama: "Kirim hadiah ke satu peringkat", fungsi: "Memberi hadiah manual ke satu peringkat saja.", isi: "Peringkat (1, 2, 3…), nominal Rupiah, dan catatan yang dibaca penerima.", contoh: "Peringkat: 1 · Nominal: 10000 · Catatan: Bonus juara bertahan 3 minggu" },
      { nama: "Pengaturan hadiah", fungsi: "Besar hadiah per peringkat.", isi: "Angka dipisah koma, urut dari peringkat 1.", contoh: "5000, 3000, 1000" }
    ]
  },

  produk: {
    judul: "Produk",
    ringkas: "Produk digital yang kamu jual selain nokos (voucher, akun, file).",
    item: [
      { nama: "Nama Produk *", fungsi: "Nama yang dilihat pembeli.", isi: "Teks singkat." },
      { nama: "Harga (Rp) *", fungsi: "Harga jual.", isi: "Angka Rupiah tanpa titik.", contoh: "10000" },
      { nama: "Kategori", fungsi: "Pengelompokan produk.", isi: "Kata kunci, dipisah koma bila lebih dari satu.", contoh: "digital, game, voucher" },
      { nama: "Stok (-1 = unlimited)", fungsi: "Jumlah yang tersedia.", isi: "Angka. -1 = tidak terbatas.", contoh: "-1" },
      { nama: "Deskripsi / URL Gambar", fungsi: "Teks dan gambar produk.", isi: "Deskripsi bebas; URL gambar diawali https://." },
      { nama: "Tipe Pengiriman", fungsi: "Bentuk barang yang dikirim ke pembeli.", isi: "Teks, Gambar (URL), atau File (URL)." },
      { nama: "Konten Pengiriman *", fungsi: "Isi yang diterima pembeli setelah berhasil beli.", isi: "Teks, atau alamat gambar/file sesuai tipe.", catatan: "Jangan taruh isi yang bersifat rahasia permanen bila stok unlimited — semua pembeli menerima isi yang sama." },
      { nama: "Tambah Stok Produk", fungsi: "Menambah stok produk yang ada.", isi: "Pilih produk dan isi jumlah." }
    ]
  },

  job: {
    judul: "Job / Saldo",
    ringkas: "Tugas berbayar untuk pengguna (follow, review, dll) — mereka mengirim bukti, kamu memeriksa, saldo cair setelah disetujui.",
    item: [
      { nama: "Judul Job *", fungsi: "Nama tugas.", isi: "Teks singkat." },
      { nama: "Reward (Rp) *", fungsi: "Saldo yang diterima pengguna per tugas yang disetujui.", isi: "Angka Rupiah.", contoh: "5000" },
      { nama: "Maks Penyelesaian (0 = unlimited)", fungsi: "Berapa kali tugas boleh diselesaikan.", isi: "Angka. 0 = tanpa batas.", catatan: "Total pengeluaran = reward × maks penyelesaian." },
      { nama: "Tipe Bukti", fungsi: "Bentuk bukti yang dikirim pengguna.", isi: "Teks, Gambar (URL), atau URL." },
      { nama: "Kategori", fungsi: "Pengelompokan tugas.", isi: "Kata kunci.", contoh: "sosmed, review, tugas" },
      { nama: "Deskripsi / Instruksi", fungsi: "Langkah yang harus dikerjakan.", isi: "Tulis jelas apa yang dianggap sah." },
      { nama: "Review Pengajuan", fungsi: "Menyetujui atau menolak bukti yang dikirim.", isi: "Alasan penolakan dibaca pengguna.", catatan: "Setuju = saldo langsung masuk ke pengguna." }
    ]
  },

  tiket: {
    judul: "Tiket",
    ringkas: "Pesan bantuan dari pengguna.",
    item: [
      { nama: "Daftar tiket", fungsi: "Membuka percakapan satu tiket.", isi: "Klik tiket untuk membaca." },
      { nama: "Balasan", fungsi: "Membalas pengguna.", isi: "Tulis balasan lalu kirim.", contoh: "Halo, saldo sudah kami kembalikan ya." },
      { nama: "Tutup tiket", fungsi: "Menandai masalah selesai.", isi: "Tombol." }
    ]
  },

  pengaturan: {
    judul: "Pengaturan Umum",
    ringkas: "Pengaturan inti toko: markup harga, maintenance, metode deposit, server nokos, loyalitas, notifikasi channel, dan alamat API untuk dokumentasi.",
    item: [
      { nama: "Markup harga jual OTP (%)", fungsi: "Persen yang ditambahkan ke harga modal provider.", isi: "Angka persen. Tiap server bisa punya markup sendiri di kartu Server OTP.", contoh: "Modal Rp1.000 dan markup 20 → dijual Rp1.200." },
      { nama: "Mode maintenance", fungsi: "Menutup web untuk pengunjung sementara kamu bekerja.", isi: "Saklar. Judul, pesan, dan tombol halaman maintenance diisi di bawahnya.", catatan: "Admin tetap bisa masuk. Jangan lupa mematikannya." },
      { nama: "Username Customer Service", fungsi: "Tujuan tombol CS di web dan bot.", isi: "Username Telegram tanpa @.", contoh: "teatlas" },
      { nama: "Metode deposit QRIS", fungsi: "Nama, label, estimasi, dan biaya yang dilihat pengguna saat memilih metode bayar, serta saklar nyala/mati.", isi: "Nama metode, label (mis. TERCEPAT), estimasi waktu (mis. ± 30 detik), biaya admin (%).", catatan: "Biaya di sini hanya perkiraan tampilan; nominal pasti dari penyedia." },
      { nama: "QRIS Manual (dicek admin)", fungsi: "QRIS pribadimu sendiri; pembeli membayar lalu mengunggah bukti.", isi: "Gambar QRIS, atas nama, label, batas waktu bayar (menit), cashback (%), jam layanan (WIB), cara bayar.", contoh: "Atas nama: ARTA PEDIA ID · Batas waktu: 60", catatan: "Tanpa gambar QRIS, metode ini tidak bisa dipakai. Di luar jam layanan metode tutup." },
      { nama: "Verifikasi otomatis (OCR) QRIS manual", fungsi: "Membaca bukti transfer otomatis supaya tidak semua perlu dicek manual.", isi: "Nama penerima yang harus terbaca (pisah koma), maks per deposit (Rp), maks per user per hari (Rp).", contoh: "NAWA CELL · 200000 · 500000", catatan: "Gambar bukti bisa direkayasa — batasi nominalnya serendah yang masih nyaman." },
      { nama: "Pet Arta Pedia", fungsi: "Hewan peliharaan virtual yang menambah cashback deposit.", isi: "Saklar dan angka bonus/xp.", catatan: "Bonus dibatasi nilai maksimal supaya tidak menggerus untung." },
      { nama: "Loyalitas & Cashback", fungsi: "Poin dari transaksi, cashback deposit, dan level badge.", isi: "Poin per Rupiah, nilai 1 poin (Rp), minimal tukar poin, cashback deposit (%), batas total belanja badge Silver dan Gold (Rp).", contoh: "Silver: 100000 · Gold: 500000" },
      { nama: "Info Stok & Harga ke Channel", fungsi: "Mengirim laporan stok/harga layanan ke channel Telegram.", isi: "Kode layanan dipisah koma. Tekan 'Lihat semua kode layanan' kalau lupa kodenya.", contoh: "wa,tg,gojek,shopee" },
      { nama: "Transfer Saldo Antar Pengguna", fungsi: "Mengatur apakah pengguna boleh saling transfer saldo.", isi: "Saklar, biaya admin (%), biaya tetap (Rp), minimal dan maksimal transfer (Rp; maksimal 0 = bebas).", catatan: "Biaya ditanggung pengirim dan menjadi pendapatanmu." },
      { nama: "Server OTP", fungsi: "Mengatur tiap server nokos (RumahOTP, WarungNokos, Dibanana).", isi: "Nama server, label, keterangan singkat, markup khusus (kosong = ikut global), pesan saat server dimatikan, dan saklar aktif.", contoh: "Pesan saat dimatikan: Server sedang perbaikan, pakai Server Plus dulu ya", catatan: "Server yang dimatikan tidak muncul di API dan order ke sana ditolak." },
      { nama: "Pengaturan Situs & Env", fungsi: "Nama situs, URL situs, dan batas deposit.", isi: "Nama Situs (teks), URL Situs (alamat web ini, diawali https://), minimal dan maksimal deposit (Rp).", catatan: "URL Situs dipakai untuk memasang webhook bot. Salah ketik = bot berhenti merespons." },
      { nama: "🔗 Alamat API (Base URL)", fungsi: "Alamat dasar yang tampil di dokumentasi API Developer (nokos) dan dokumentasi QRIS Gateway.", isi: "Domain saja, diawali https://, tanpa path. Tekan 'Cek alamat' untuk memastikan alamat benar-benar terhubung ke web ini.", contoh: "https://api.tokomu.com", catatan: "Domain harus sudah ditambahkan di hosting dan DNS-nya mengarah ke web ini, kalau tidak developer tidak bisa memakainya. Kosong = ikut URL Situs." },
      { nama: "Komik Pembuka", fungsi: "Animasi komik di kunjungan pertama.", isi: "Saklar.", catatan: "Memakan sekitar 17 detik; matikan bila memasang iklan berbayar." },
      { nama: "Klaim Garansi", fungsi: "Menyalakan/mematikan tombol klaim garansi nokos.", isi: "Saklar dan catatan singkat untuk pengguna." },
      { nama: "Notifikasi ke Channel", fungsi: "Memilih jenis kejadian yang diumumkan ke channel Telegram publik.", isi: "Saklar per jenis notifikasi." },
      { nama: "Markup Kustom per Platform", fungsi: "Daftar markup per platform tersimpan di database.", isi: "Nama platform dan persen markup (0–200).", catatan: "Saat ini harga order dihitung dari markup global dan markup per server (kartu Server OTP); daftar ini belum dipakai di perhitungan harga order." }
    ]
  },

  tools: {
    judul: "Tools",
    ringkas: "Alat pemeliharaan: kirim notifikasi massal, backup, export, dan restore data.",
    item: [
      { nama: "Blast Notifikasi / Kirim Notifikasi", fungsi: "Mengirim pesan ke semua pengguna atau satu pengguna.", isi: "Judul dan isi pesan; untuk satu pengguna tambahkan kode akunnya.", catatan: "Pesan massal tidak bisa ditarik kembali. Baca ulang sebelum mengirim." },
      { nama: "Statistik Gamifikasi", fungsi: "Angka pemakaian misi, level, dan streak.", isi: "Tidak ada isian." },
      { nama: "Klaim Garansi Nokos", fungsi: "Memproses klaim garansi dari pengguna.", isi: "Setujui (saldo kembali) atau tolak dengan alasan." },
      { nama: "Security — Auto-Ban", fungsi: "Melihat dan menjalankan pemindaian akun mencurigakan.", isi: "Tombol.", catatan: "Saklar otomatis ada di Konfigurasi: KEAMANAN_OTOMATIS dan KEAMANAN_SUSPEND_OTOMATIS." },
      { nama: "Export Data (CSV)", fungsi: "Mengunduh data dalam bentuk spreadsheet.", isi: "Pilih jenis data, rentang 'Dari Tanggal' dan 'Sampai Tanggal', dan batas baris." },
      { nama: "Backup Otomatis lewat Bot", fungsi: "Mengirim backup berkala ke chat pemilik di Telegram.", isi: "Nyala/mati dan 'Kirim setiap' 1 atau 2 hari.", catatan: "Butuh bot notifikasi dan Chat ID admin terisi di Konfigurasi." },
      { nama: "Database Akun / Backup Penuh (JSON)", fungsi: "Mengunduh salinan data untuk disimpan sendiri.", isi: "Tombol unduh.", catatan: "Berisi data pengguna — simpan di tempat aman." },
      { nama: "Import / Restore Data User", fungsi: "Memasukkan data dari file backup.", isi: "Pilih mode lalu unggah file JSON. Merge = perbarui yang ada + tambah baru. Safe = hanya tambah yang belum ada. Restore Penuh = HAPUS semua lalu isi ulang.", catatan: "Restore Penuh berbahaya: unduh Backup Penuh dulu sebelum mencobanya." }
    ]
  }
};

/** Panduan satu tab, atau null bila tab itu belum punya. */
export function panduanTab(id) {
  return PANDUAN[id] || null;
}
