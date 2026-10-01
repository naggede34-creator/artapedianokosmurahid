// Daftar semua isian konfigurasi yang bisa diisi dari dasbor admin ATAU dari
// Environment Variables Vercel.
//
// Aturannya satu, dan sengaja sederhana:
//   - diisi di web            → langsung jalan
//   - diisi di Vercel         → langsung jalan
//   - diisi di salah satunya  → cukup, tidak perlu mengisi di dua tempat
// Kalau keduanya terisi, yang dari web dipakai (lebih baru, dan yang sengaja
// diketik orang di dasbor menang atas yang sudah lama tertanam di Vercel).
//
// Berkas ini SENGAJA tidak mengimpor apa pun (tanpa database, tanpa crypto):
// panel admin adalah komponen klien dan butuh daftar ini untuk menggambar
// formulirnya, dan sekali database ikut terbawa ke bundel peramban, koneksinya
// ikut bocor ke sana.
//
// hanyaEnv: tidak boleh disimpan di web, dengan alasannya masing-masing —
//   MONGODB_URI  dipakai untuk MEMBUKA database; tidak bisa dibaca dari
//                database yang belum terbuka.
//   CRON_SECRET  Vercel Cron mengirim header dari Environment Variable-nya
//                sendiri. Nilai yang cuma ada di web tidak pernah dikirim ke
//                jadwalnya, jadi semua cron akan ditolak.
export const GRUP = [
  { id: "admin", judul: "🔐 Keamanan admin" },
  { id: "otp", judul: "📱 Penyedia nomor (OTP)" },
  { id: "bayar", judul: "💳 Pembayaran QRIS" },
  { id: "telegram", judul: "🤖 Telegram & bot" },
  { id: "web", judul: "🌐 Website" },
  { id: "reseller", judul: "🏪 Reseller & kreator" },
  { id: "lain", judul: "⚙️ Lainnya" }
];

const url = { cek: /^https:\/\/[^\s]+$/i, pesanCek: "Harus diawali https://" };
const angka = (maks) => ({
  cek: new RegExp("^\\d+(\\.\\d+)?$"),
  pesanCek: `Harus angka${maks ? ` (0–${maks})` : ""}`,
  maks
});
const tokenBot = { cek: /^\d{6,}:[A-Za-z0-9_-]{20,}$/, pesanCek: "Format token bot: 1234567890:AAH..." };
const idTelegram = { cek: /^(@[A-Za-z0-9_]{4,}|-?\d{5,})$/, pesanCek: "Isi ID angka (contoh -1001234567890) atau @username channel" };
const daftarId = { cek: /^\s*\d{5,}(\s*[,;\s]\s*\d{5,})*\s*$/, pesanCek: "Isi ID angka Telegram, pisahkan dengan koma" };

export const KONFIG = [
  // ── Keamanan admin ────────────────────────────────────────────────────────
  {
    nama: "ADMIN_CODE", grup: "admin", label: "Kode admin", rahasia: true, khusus: "kodeAdmin",
    bantuan:
      "Kode untuk masuk ke /admin. Kalau diisi di web, disimpan sebagai hash (tidak bisa dibaca balik). " +
      "Kode dari Vercel tetap berlaku sebagai kunci cadangan kalau kamu lupa kode dari web."
  },
  {
    nama: "ADMIN_SECRET", grup: "admin", label: "Rahasia tanda tangan sesi (opsional)", rahasia: true, lanjutan: true,
    bantuan: "Boleh dikosongkan. Kalau kosong, diturunkan otomatis dari kode admin."
  },
  {
    nama: "CRON_SECRET", grup: "admin", label: "Rahasia cron", rahasia: true, hanyaEnv: true,
    bantuan:
      "Hanya bisa lewat Vercel → Settings → Environment Variables. Vercel Cron mengirim header dari variabel itu sendiri; " +
      "nilai yang hanya ada di web tidak pernah dikirim, dan semua cron akan ditolak. Kosong = endpoint cron terbuka."
  },
  {
    nama: "MONGODB_URI", grup: "admin", label: "Alamat database MongoDB", rahasia: true, hanyaEnv: true,
    bantuan: "Hanya bisa lewat Vercel: ia dipakai untuk membuka database, jadi tidak bisa dibaca dari database itu sendiri."
  },

  // ── Penyedia nomor ────────────────────────────────────────────────────────
  { nama: "RUMAHOTP_APIKEY", grup: "otp", label: "RumahOTP — API key", rahasia: true, contoh: "otp_xxxxxxxx" },
  { nama: "WARUNGNOKOS_APIKEY", grup: "otp", label: "WarungNokos — API key", rahasia: true },
  { nama: "WARUNGNOKOS_BASE_URL", grup: "otp", label: "WarungNokos — alamat API", bawaan: "https://warungnokos.web.id", ...url, lanjutan: true },
  { nama: "DIBANANA_APIKEY", grup: "otp", label: "Dibanana — API key", rahasia: true },
  { nama: "NEOXR_API_KEY", grup: "otp", label: "Neoxr — API key", rahasia: true, lanjutan: true },

  // ── Pembayaran ────────────────────────────────────────────────────────────
  { nama: "PAKASIR_PROJECT", grup: "bayar", label: "Pakasir — slug proyek", contoh: "nama-proyek" },
  { nama: "PAKASIR_APIKEY", grup: "bayar", label: "Pakasir — API key", rahasia: true },
  { nama: "PAKASIR_MERCHANT_ID", grup: "bayar", label: "Pakasir — merchant ID (untuk cek kesehatan)", lanjutan: true },
  { nama: "PAKASIR_BASE_URL", grup: "bayar", label: "Pakasir — alamat API", bawaan: "https://app.pakasir.com", ...url, lanjutan: true },
  {
    nama: "ATLANTIC_APIKEY", grup: "bayar", label: "Atlantic H2H — API key", rahasia: true,
    bantuan: "PERINGATAN: kunci ini bisa memindahkan uang KELUAR lewat transfer. Jangan pernah dibagikan."
  },
  { nama: "ATLANTIC_BASE_URL", grup: "bayar", label: "Atlantic — alamat API", bawaan: "https://atlantich2h.com", ...url, lanjutan: true },

  // ── Telegram ──────────────────────────────────────────────────────────────
  { nama: "TELEGRAM_BOT_TOKEN", grup: "telegram", label: "Bot notifikasi admin — token", rahasia: true, ...tokenBot },
  { nama: "TELEGRAM_CHAT_ID", grup: "telegram", label: "Chat ID admin (tujuan notifikasi)", ...idTelegram },
  { nama: "TELEGRAM_CHANNEL_ID", grup: "telegram", label: "Channel publik (ID atau @username)", ...idTelegram },
  { nama: "TELEGRAM_OWNER_IDS", grup: "telegram", label: "ID Telegram owner (boleh banyak, pisah koma)", ...daftarId },
  { nama: "TELEGRAM_WEBHOOK_SECRET", grup: "telegram", label: "Secret webhook bot notifikasi", rahasia: true, lanjutan: true },
  { nama: "SHOP_BOT_TOKEN", grup: "telegram", label: "Bot toko — token", rahasia: true, ...tokenBot },
  { nama: "SHOP_BOT_WEBHOOK_SECRET", grup: "telegram", label: "Secret webhook bot toko", rahasia: true, lanjutan: true },
  { nama: "SHOP_BOT_OWNER_IDS", grup: "telegram", label: "ID owner bot toko (kosong = pakai owner notifikasi)", ...daftarId, lanjutan: true },
  {
    nama: "CHANNEL_HASHTAG", grup: "telegram", label: "Hashtag di bawah tiap kiriman channel",
    bawaan: "#nokos #nokosmurah #otp @artapediaaaa", lanjutan: true,
    bantuan: "Baris teks terakhir di kiriman channel (setelah tombol). Kosongkan untuk menghilangkannya."
  },
  {
    nama: "NOTIF_TOKEN_PENUH", grup: "telegram", label: "Notif admin — tampilkan kode akun UTUH (1 = ya, 0 = samarkan, kosong = otomatis)",
    cek: /^[01]$/, pesanCek: "Isi 1, 0, atau kosongkan", lanjutan: true,
    bantuan:
      "Notif ke chat admin memuat kode akun utuh supaya mudah dicari. Kosong = otomatis: utuh hanya kalau TELEGRAM_CHAT_ID adalah chat PRIBADI; " +
      "kalau berupa grup/channel, kode disamarkan. Salinan ke channel publik SELALU tersamar apa pun isinya. Kode akun adalah kunci masuk akun — jangan isi 1 kalau chat admin dibaca banyak orang."
  },
  { nama: "TELEGRAM_MONITOR_CHAT_ID", grup: "telegram", label: "Chat pemantau cron", bawaan: "@diskusiduniotp", ...idTelegram, lanjutan: true },
  { nama: "TELEGRAM_MONITOR_THREAD_ID", grup: "telegram", label: "Thread pemantau cron", bawaan: "2949", lanjutan: true },

  // ── Lainnya ───────────────────────────────────────────────────────────────
  {
    nama: "RICH_MESSAGE", grup: "lain", label: "Rich Message Telegram (1 = nyala, 0 = mati)", bawaan: "1",
    cek: /^[01]$/, pesanCek: "Isi 1 (nyala) atau 0 (mati)",
    bantuan:
      "Pesan bot tampil dengan judul, tabel, dan tombol berwarna lewat sendRichMessage (Bot API 10.1+). " +
      "Kalau Telegram menolaknya, pesan otomatis dikirim dalam bentuk biasa. Isi 0 untuk mematikan sepenuhnya."
  },
  // ── Website ───────────────────────────────────────────────────────────────
  {
    nama: "WEB_LOGIN_WAJIB", grup: "web", label: "Wajib daftar / login di website", bawaan: "0", saklar: true,
    cek: /^[01]$/, pesanCek: "Isi 1 (nyala) atau 0 (mati)",
    bantuan:
      "MATI: website seperti biasa, akun dibuat otomatis tanpa daftar. NYALA: pengunjung harus daftar (cukup isi nama, lalu dapat kode akun) " +
      "atau masuk dengan kode akun. Pengguna lama yang sudah tersimpan di perangkatnya tetap masuk otomatis."
  },
  {
    nama: "TURN_URL", grup: "web", label: "Panggilan WEARTA CHAT — alamat server TURN (opsional)", lanjutan: true,
    cek: /^(turns?:[^\s,]+)([\s,]+turns?:[^\s,]+)*$/i, pesanCek: "Contoh: turn:turn.contoh.com:3478 (boleh beberapa, pisahkan koma)",
    bantuan: "Tanpa TURN, panggilan hanya tersambung bila kedua pihak tidak di balik NAT yang ketat (bawaan memakai STUN publik Google). Isi kalau sebagian pengguna gagal tersambung."
  },
  { nama: "TURN_USERNAME", grup: "web", label: "Panggilan WEARTA CHAT — username TURN", lanjutan: true },
  { nama: "TURN_CREDENTIAL", grup: "web", label: "Panggilan WEARTA CHAT — password TURN", rahasia: true, lanjutan: true },
  // ── Duel permainan ────────────────────────────────────────────────────────
  {
    nama: "GAME_AKTIF", grup: "web", label: "Duel permainan (Arena Pendekar, catur, UNO, remi, mahjong, domino gaple)", bawaan: "1", saklar: true,
    cek: /^[01]$/, pesanCek: "Isi 1 (nyala) atau 0 (mati)",
    bantuan: "Mematikannya menutup duel baru; duel yang sudah berjalan tetap bisa diselesaikan."
  },
  {
    nama: "GAME_TARUHAN_AKTIF", grup: "web", label: "Taruhan saldo di duel", bawaan: "1", saklar: true,
    cek: /^[01]$/, pesanCek: "Isi 1 (nyala) atau 0 (mati)",
    bantuan: "MATI: duel hanya untuk seru-seruan, tanpa saldo. Ingat: taruhan uang sungguhan punya risiko hukum di banyak tempat — pastikan kamu paham aturan yang berlaku."
  },
  { nama: "GAME_TARUHAN_MIN", grup: "web", label: "Taruhan minimal per pemain (Rp)", bawaan: "1000", ...angka(), lanjutan: true },
  { nama: "GAME_TARUHAN_MAKS", grup: "web", label: "Taruhan maksimal per pemain (Rp)", bawaan: "100000", ...angka(), lanjutan: true },
  {
    nama: "GAME_FEE_PERSEN", grup: "web", label: "Potongan admin dari total taruhan (%)", bawaan: "5", ...angka(50), lanjutan: true,
    bantuan: "Diambil dari total taruhan kedua pemain, hanya bila ada pemenang. Seri atau batal: taruhan dikembalikan utuh."
  },
  {
    nama: "GAME_NOTIF_ADMIN", grup: "web", label: "Kabari admin saat pengguna masuk dasbor game / mulai game", bawaan: "1", saklar: true,
    cek: /^[01]$/, pesanCek: "Isi 1 (nyala) atau 0 (mati)",
    bantuan: "Mengirim notifikasi Telegram ke admin ketika ada pengguna memasuki dasbor game, memulai game solo (Plinko / Mahjong Spin), atau membuka duel. " +
      "Masuk dasbor dan mulai solo dikabari sekali per pengguna dalam jeda 30 / 10 menit supaya tidak membanjiri."
  },
  // ── Game solo (Plinko, Mahjong Spin 1024) ─────────────────────────────────
  {
    nama: "GAME_SOLO_AKTIF", grup: "web", label: "Game solo (Plinko & Mahjong Spin 1024)", bawaan: "1", saklar: true,
    cek: /^[01]$/, pesanCek: "Isi 1 (nyala) atau 0 (mati)",
    bantuan: "Game solo memakai POIN GAME pemain. MATI di sini menutup Plinko & Mahjong Spin. (GAME_KASINO_AKTIF juga bisa menutupnya.)"
  },
  {
    nama: "GAME_KASINO_AKTIF", grup: "web", label: "Game solo: main dengan POIN GAME (taruhan sungguhan)", bawaan: "1", saklar: true,
    cek: /^[01]$/, pesanCek: "Isi 1 (nyala) atau 0 (mati)",
    bantuan: "PERHATIAN: Plinko & slot dengan uang sungguhan adalah perjudian, yang dilarang atau diatur ketat di banyak negara (termasuk Indonesia) dan bisa merugikan pemain. " +
      "Bawaannya NYALA: Plinko & Mahjong Spin memakai POIN GAME pemain (tidak ada lagi koin latihan). MATIKAN untuk menutup kedua game solo. Pahami dan terima risiko hukum & tanggung jawabnya. Peluang menang dibuat adil (RTP ≈ 96%), tetapi rumah selalu untung dalam jangka panjang."
  },
  { nama: "GAME_SOLO_MIN", grup: "web", label: "Game solo — taruhan saldo minimal (Rp)", bawaan: "1000", ...angka(), lanjutan: true },
  { nama: "GAME_SOLO_MAKS", grup: "web", label: "Game solo — taruhan saldo maksimal (Rp)", bawaan: "50000", ...angka(), lanjutan: true },
  {
    nama: "GAME_SOLO_RUGI_HARIAN", grup: "web", label: "Game solo — batas rugi harian per pengguna (Rp, 0 = tanpa batas)", bawaan: "200000", ...angka(), lanjutan: true,
    bantuan: "Perlindungan pemain: bila kerugian bersih hari ini (WIB) akan melewati batas, ronde ditolak sampai besok."
  },
  { nama: "GAME_SOLO_MAKS_MENANG", grup: "web", label: "Game solo — batas kemenangan per ronde (Rp)", bawaan: "5000000", ...angka(), lanjutan: true },
  { nama: "GAME_KOIN_AWAL", grup: "web", label: "Game solo — modal koin latihan per pengguna", bawaan: "10000", ...angka(), lanjutan: true },
  // ── Poin Game (saldo game: 2 poin = Rp1.000) ──────────────────────────────
  { nama: "GAME_POIN_TOPUP_MIN", grup: "web", label: "Poin Game — minimal isi poin", bawaan: "2", ...angka(), lanjutan: true, bantuan: "Dalam poin. 2 poin = Rp1.000." },
  { nama: "GAME_POIN_TOPUP_MAKS", grup: "web", label: "Poin Game — maksimal isi poin per transaksi", bawaan: "20000", ...angka(), lanjutan: true, bantuan: "Dalam poin. 20.000 poin = Rp10.000.000." },
  {
    nama: "GAME_TARIK_AKTIF", grup: "web", label: "Poin Game — penarikan ke e-wallet", bawaan: "1", saklar: true,
    cek: /^[01]$/, pesanCek: "Isi 1 (nyala) atau 0 (mati)",
    bantuan: "Pengguna mengajukan tarik poin ke e-wallet; poin langsung ditahan, lalu admin membayar manual (1–2 hari kerja) atau menolak (poin kembali)."
  },
  { nama: "GAME_TARIK_MIN_RP", grup: "web", label: "Poin Game — minimal tarik (Rp)", bawaan: "10000", ...angka(), lanjutan: true },
  { nama: "GAME_TARIK_FEE_RP", grup: "web", label: "Poin Game — biaya tarik per pengajuan (Rp; 2000 = 4 poin)", bawaan: "2000", ...angka(), lanjutan: true },
  { nama: "GAME_MENYERAH_MIN_DETIK", grup: "web", label: "Duel — boleh menyerah setelah (detik sejak mulai)", bawaan: "60", ...angka(), lanjutan: true },
  { nama: "GAME_MENYERAH_MIN_LANGKAH", grup: "web", label: "Duel — boleh menyerah setelah (jumlah langkah keseluruhan)", bawaan: "4", ...angka(), lanjutan: true },
  { nama: "GAME_PASANGAN_MAKS", grup: "web", label: "Anti-curang — maks duel bertaruh antara dua akun yang sama per 24 jam", bawaan: "4", ...angka(), lanjutan: true },
  {
    nama: "GAME_ANTICURANG_AKTIF", grup: "web", label: "Anti-curang game (deteksi akun ganda, kolusi duel)", bawaan: "1", saklar: true,
    cek: /^[01]$/, pesanCek: "Isi 1 (nyala) atau 0 (mati)",
    bantuan: "Mendeteksi beberapa akun yang bermain game pada satu perangkat/jaringan, duel antar-akun yang sama perangkat/IP, pasangan yang terlalu sering bertaruh, dan duel bertaruh yang selesai tanpa langkah. Semua temuan dikabari ke Telegram admin."
  },
  {
    nama: "GAME_ANTICURANG_IP", grup: "web", label: "Anti-curang: periksa kesamaan IP/jaringan (duel satu IP diblokir)", bawaan: "1", saklar: true,
    cek: /^[01]$/, pesanCek: "Isi 1 (nyala) atau 0 (mati)",
    bantuan: "NYALA = duel antar-akun yang memakai IP/jaringan sama diblokir (peringatan, lalu ban pada pelanggaran ke-2) dan banyak akun satu IP dikabari. Matikan bila banyak pemain sah berbagi jaringan (kos, kantor, internet seluler). Pemeriksaan perangkat tetap berjalan."
  },
  {
    nama: "GAME_ANTICURANG_BAN", grup: "web", label: "Anti-curang: BAN otomatis akun yang melanggar", bawaan: "1", saklar: true,
    cek: /^[01]$/, pesanCek: "Isi 1 (nyala) atau 0 (mati)",
    bantuan: "NYALA = akun terbukti melanggar dibekukan otomatis (bisa dibuka admin lewat tab Pengguna). MATI = hanya dikabari ke admin, tidak ada ban otomatis."
  },
  { nama: "GAME_TARIK_JAM", grup: "web", label: "Poin Game — teks jam kerja admin (dilihat pengguna)", bawaan: "Diproses maksimal 1–2 hari kerja sesuai jam kerja admin", lanjutan: true },
  {
    nama: "GAME_TUKAR_AKTIF", grup: "web", label: "Poin Game — tukar poin ke saldo nokos", bawaan: "1", saklar: true,
    cek: /^[01]$/, pesanCek: "Isi 1 (nyala) atau 0 (mati)"
  },
  {
    nama: "GAME_ISI_NOKOS_AKTIF", grup: "web", label: "Poin Game — isi poin dari saldo nokos", bawaan: "1", saklar: true,
    cek: /^[01]$/, pesanCek: "Isi 1 (nyala) atau 0 (mati)",
    bantuan: "Pengguna boleh mengubah saldo nokos jadi poin game (1 poin = Rp500). Poin hasil ubahan dihitung seperti poin yang diisi: harus diputar dulu (syarat perputaran) sebelum ditukar/ditarik."
  },
  { nama: "GAME_ISI_NOKOS_FEE_PERSEN", grup: "web", label: "Poin Game — potongan ubah saldo nokos ke poin (%)", bawaan: "0", ...angka(50), lanjutan: true },
  { nama: "GAME_TUKAR_FEE_PERSEN", grup: "web", label: "Poin Game — potongan tukar ke saldo nokos (%)", bawaan: "0", ...angka(50), lanjutan: true },
  {
    nama: "GAME_SYARAT_PUTAR_KALI", grup: "web", label: "Poin Game — syarat perputaran sebelum tukar/tarik (× total isi poin)", bawaan: "1", ...angka(), lanjutan: true,
    bantuan: "Pencegah cuci uang & penipuan bukti palsu: poin baru boleh ditukar/ditarik setelah total taruhan game ≥ (angka ini × total poin yang pernah diisi). 0 = tanpa syarat (tidak disarankan)."
  },
  // ── Reseller & kreator ────────────────────────────────────────────────────
  {
    nama: "RESELLER_SLOT_HARGA", grup: "reseller", label: "Slot bot tambahan — harga per slot (Rp)", bawaan: "10000", ...angka(),
    bantuan: "Reseller bisa membeli slot bot di luar jatah 3 bot, dibayar dari saldo. 0 = penjualan slot dimatikan."
  },
  {
    nama: "RESELLER_SLOT_MAKS", grup: "reseller", label: "Slot bot tambahan — maksimal yang boleh dibeli", bawaan: "5", ...angka(50), lanjutan: true
  },
  {
    nama: "RESELLER_PREMIUM_HARGA", grup: "reseller", label: "Paket Premium reseller — harga (Rp)", bawaan: "30000", ...angka(),
    bantuan: "Premium: slot bot tambahan, batas markup lebih tinggi, dan tambahan potongan harga grosir. 0 = paket dimatikan."
  },
  { nama: "RESELLER_PREMIUM_HARI", grup: "reseller", label: "Paket Premium — masa berlaku (hari)", bawaan: "30", ...angka(365), lanjutan: true },
  { nama: "RESELLER_PREMIUM_SLOT", grup: "reseller", label: "Paket Premium — tambahan slot bot", bawaan: "2", ...angka(20), lanjutan: true },
  { nama: "RESELLER_PREMIUM_MARKUP_MAKS", grup: "reseller", label: "Paket Premium — batas markup (%)", bawaan: "200", ...angka(1000), lanjutan: true },
  { nama: "RESELLER_PREMIUM_DISKON", grup: "reseller", label: "Paket Premium — tambahan potongan grosir (%)", bawaan: "1", ...angka(20), lanjutan: true },
  {
    nama: "RESELLER_TIER", grup: "reseller", label: "Level reseller (omzet bulanan : potongan grosir % : bonus target Rp)",
    bawaan: "1000000:2:10000,5000000:4:50000,20000000:6:250000",
    cek: /^\s*(\d+:\d+(\.\d+)?:\d+)(\s*,\s*\d+:\d+(\.\d+)?:\d+)*\s*$/,
    pesanCek: "Format omzet:potongan:bonus, pisahkan koma. Contoh 1000000:2:10000,5000000:4:50000",
    bantuan:
      "Tiap level: omzet penjualan BERHASIL bulan itu (Rp) : potongan harga grosir untuk komisi (%) : bonus target sekali per bulan (Rp, masuk saldo). " +
      "Level dipertahankan sampai bulan berikutnya. Potongan tidak pernah membuat harga di bawah modal."
  },
  {
    nama: "AFILIASI_PERSEN", grup: "reseller", label: "Program kreator — komisi bawaan (% dari untung toko)", bawaan: "20", ...angka(90),
    bantuan:
      "Kreator yang disetujui admin mendapat persen ini dari UNTUNG toko (harga jual − modal) tiap nomor yang berhasil dibeli teman yang mereka undang, " +
      "selamanya. Admin bisa mengatur persen berbeda per kreator. 0 = program dimatikan."
  },
  {
    nama: "VAPID_PUBLIC_KEY", grup: "lain", label: "Push web — kunci publik VAPID", lanjutan: true,
    bantuan: "Kosongkan: kunci dibuat otomatis saat pertama dipakai. Isi (bersama kunci privat) hanya kalau mau memakai kunci sendiri."
  },
  {
    nama: "VAPID_PRIVATE_KEY", grup: "lain", label: "Push web — kunci privat VAPID", rahasia: true, lanjutan: true,
    bantuan: "Pasangan kunci publik di atas. Mengganti kunci membuat semua langganan lama tidak berlaku."
  },
  {
    nama: "VAPID_SUBJECT", grup: "lain", label: "Push web — kontak (mailto: atau https://)", bawaan: "mailto:admin@artapedia.id",
    cek: /^(mailto:[^\s@]+@[^\s@]+|https:\/\/\S+)$/, pesanCek: "Isi mailto:email@domain atau alamat https://", lanjutan: true
  },
  {
    nama: "JAMINAN_PERSEN", grup: "lain", label: "Jaminan OTP — biaya (% dari harga nomor)", bawaan: "10", ...angka(50),
    bantuan:
      "Pembeli boleh menambah jaminan: kalau kode OTP belum masuk sesudah beberapa menit, nomornya diganti otomatis. " +
      "Biaya jaminan hanya ditahan kalau kode akhirnya masuk; kalau gagal, seluruhnya dikembalikan. 0 = fitur mati."
  },
  {
    nama: "JAMINAN_MENIT", grup: "lain", label: "Jaminan OTP — tunggu berapa menit sebelum ganti", bawaan: "4", ...angka(15),
    lanjutan: true, bantuan: "Minimal 4: provider baru mau membatalkan nomor sesudah sekitar 3 menit."
  },
  {
    nama: "RICH_TOMBOL_DALAM", grup: "lain", label: "Tombol di dalam pesan (1 = di dalam, 0 = di bawah pesan)", bawaan: "1",
    cek: /^[01]$/, pesanCek: "Isi 1 atau 0", lanjutan: true,
    bantuan: "Menu bot memakai tombol yang menyatu di dalam pesan rich (rata tengah, berwarna). Isi 0 untuk tombol biasa di bawah pesan."
  },
  {
    nama: "REFERRAL_MIN_DEPOSIT", grup: "lain", label: "Bonus undang teman — minimal deposit teman (Rp)", bawaan: "10000", ...angka(),
    lanjutan: true, bantuan: "Deposit teman di bawah ini tidak memicu bonus. Anti-farming: akun palsu biasanya deposit receh."
  },
  {
    nama: "REFERRAL_MAKS_BONUS", grup: "lain", label: "Bonus undang teman — maksimal per teman (Rp)", bawaan: "50000", ...angka(),
    lanjutan: true, bantuan: "Bonus dijepit ke angka ini. 0 = tanpa batas."
  },
  {
    nama: "REFERRAL_MAKS_HARIAN", grup: "lain", label: "Bonus undang teman — maksimal per pengundang per 24 jam", bawaan: "10", ...angka(),
    lanjutan: true, bantuan: "Lewat dari ini, bonus ditahan untuk ditinjau admin (tab Referral). 0 = tanpa batas."
  },
  {
    nama: "REFERRAL_BONUS_PERCENT", grup: "lain", label: "Bonus undang teman (% dari deposit pertama)",
    bawaan: "0", ...angka(100), bantuan: "0 = bonus undang teman dimatikan."
  }
];

export const PETA = Object.fromEntries(KONFIG.map((k) => [k.nama, k]));

/** Isi yang mungkin dikirim dari luar: hanya nama yang ada di daftar, dan bukan hanyaEnv. */
export function bolehDiweb(nama) {
  const k = PETA[nama];
  return !!k && !k.hanyaEnv;
}

/** Menyamarkan rahasia: cukup untuk mengenali, tidak cukup untuk memakainya. */
export function samarkan(nilai) {
  const s = String(nilai || "");
  if (!s) return "";
  return s.length > 10 ? `••••••••${s.slice(-4)}` : "••••••••";
}
