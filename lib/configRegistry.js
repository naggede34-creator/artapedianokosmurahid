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
  { id: "setor", judul: "📧 Stor Gmail (freelance)" },
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
  {
    nama: "AUSTINPAY_APIKEY", grup: "bayar", label: "AustinPay (QRIS FAST) — API key", rahasia: true, contoh: "apg_live_xxxxxxxx",
    bantuan:
      "PERINGATAN: kunci ini bisa memindahkan uang KELUAR dari akun AustinPay (penarikan instant). Jangan dibagikan. " +
      "AustinPay mewajibkan IP WHITELIST: Vercel tidak punya IP keluar tetap — aktifkan Static IPs Vercel atau isi AUSTINPAY_PROXY, lalu daftarkan IP-nya di Profil AustinPay."
  },
  {
    nama: "AUSTINPAY_APISECRET", grup: "bayar", label: "AustinPay — API secret (HMAC signature)", rahasia: true, contoh: "aps_xxxxxxxx",
    bantuan: "Opsional tapi SANGAT disarankan. Kalau diisi, tiap request ditandatangani HMAC-SHA256. Harus sama persis dengan secret di Profil AustinPay."
  },
  {
    nama: "AUSTINPAY_WEBHOOK_SECRET", grup: "bayar", label: "AustinPay — webhook secret (verifikasi notifikasi deposit)", rahasia: true,
    bantuan: "Isi dengan secret webhook dari menu Webhook di dashboard AustinPay; URL webhook: https://DOMAIN-KAMU/api/deposit/austinpay-webhook. Kosong = webhook ditolak (deposit tetap lunas lewat pengecekan otomatis)."
  },
  { nama: "AUSTINPAY_BASE_URL", grup: "bayar", label: "AustinPay — alamat API", bawaan: "https://austinstore.id", ...url, lanjutan: true },
  {
    nama: "AUSTINPAY_PROXY", grup: "bayar", label: "AustinPay — proxy keluar (IP tetap, opsional)", rahasia: true, lanjutan: true,
    cek: /^https?:\/\/[^\s]+$/i, pesanCek: "Format: http://user:pass@host:port",
    bantuan: "Isi bila memakai VPS/proxy ber-IP tetap agar bisa masuk whitelist AustinPay. Kosong = langsung dari server."
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
  { nama: "GAME_TARIK_MIN_RP", grup: "web", label: "Poin Game — minimal tarik (Rp)", bawaan: "15000", ...angka(), lanjutan: true },
  { nama: "GAME_TARIK_FEE_RP", grup: "web", label: "Poin Game — biaya tarik per pengajuan (Rp; 2000 = 4 poin)", bawaan: "2000", ...angka(), lanjutan: true },
  {
    nama: "GAME_TARIK_OTOMATIS", grup: "web", label: "Poin Game — penarikan OTOMATIS via AustinPay (0 = antrean admin manual)", bawaan: "1", saklar: true,
    cek: /^[01]$/, pesanCek: "Isi 1 (nyala) atau 0 (mati)",
    bantuan: "NYALA = tarik poin langsung dikirim ke e-wallet lewat AustinPay (butuh API key AustinPay). MATI / AustinPay belum diisi = pengajuan masuk antrean dan dibayar admin manual."
  },
  {
    nama: "WD_NOKOS_AKTIF", grup: "web", label: "Tarik saldo nokos ke e-wallet (otomatis via AustinPay)", bawaan: "1", saklar: true,
    cek: /^[01]$/, pesanCek: "Isi 1 (nyala) atau 0 (mati)",
    bantuan: "Pengguna menarik saldo nokos (yang berasal dari deposit) ke DANA/GoPay/ShopeePay dll. Dikirim otomatis, tanpa approval admin."
  },
  { nama: "WD_NOKOS_MIN_RP", grup: "web", label: "Tarik saldo nokos — minimal diterima (Rp)", bawaan: "10000", ...angka(), lanjutan: true },
  { nama: "WD_NOKOS_FEE_RP", grup: "web", label: "Tarik saldo nokos — biaya admin per penarikan (Rp)", bawaan: "2000", ...angka(), lanjutan: true },
  { nama: "WD_NOKOS_MAKS_HARI", grup: "web", label: "Tarik saldo nokos — maks penarikan per akun per hari", bawaan: "5", ...angka(100), lanjutan: true },
  { nama: "WD_NOKOS_MAKS_RP", grup: "web", label: "Tarik saldo nokos — maks nominal per penarikan (Rp)", bawaan: "1000000", ...angka(), lanjutan: true },
  { nama: "WD_NOKOS_MAKS_RP_HARI", grup: "web", label: "Tarik saldo nokos — maks total per akun per hari (Rp)", bawaan: "3000000", ...angka(), lanjutan: true },
  {
    nama: "MUSIM_AKTIF", grup: "web", label: "Event musiman otomatis (diskon, cashback, banner, tema)", bawaan: "1", saklar: true,
    cek: /^[01]$/, pesanCek: "Isi 1 (nyala) atau 0 (mati)",
    bantuan: "Nyala = tanggal kembar, gajian, Ramadan, Lebaran, Natal, 17 Agustus, dll. otomatis aktif sesuai kalender. Mati = semua event (termasuk diskonnya) berhenti."
  },
  { nama: "MUSIM_DISKON_MAKS", grup: "web", label: "Event musiman — batas atas diskon harga nokos (%)", bawaan: "10", ...angka(50), lanjutan: true },
  {
    nama: "ARENA_MUSIM_AKTIF", grup: "web", label: "Season Arena Pendekar (peringkat musiman & turnamen mingguan)", bawaan: "1", saklar: true,
    cek: /^[01]$/, pesanCek: "Isi 1 (nyala) atau 0 (mati)",
    bantuan: "Nyala = duel Arena Pendekar antar pemain dihitung ke peringkat (ELO) & turnamen mingguan, hadiah dibayar otomatis saat periode berganti."
  },
  { nama: "ARENA_HADIAH_MUSIM", grup: "web", label: "Season Arena — hadiah akhir musim per peringkat (Rp, pisah koma)", bawaan: "50000,25000,10000", cek: /^\s*\d+(\s*[,;\s]\s*\d+){0,9}\s*$/, pesanCek: "Contoh: 50000,25000,10000 (maks 10 peringkat)", lanjutan: true, bantuan: "Dibayar ke Saldo Game. Peringkat 1,2,3,… sesuai urutan angka." },
  { nama: "ARENA_HADIAH_MINGGU", grup: "web", label: "Turnamen mingguan — hadiah per peringkat (Rp, pisah koma)", bawaan: "20000,10000,5000", cek: /^\s*\d+(\s*[,;\s]\s*\d+){0,9}\s*$/, pesanCek: "Contoh: 20000,10000,5000 (maks 10 peringkat)", lanjutan: true },
  { nama: "ARENA_MIN_MAIN_MUSIM", grup: "web", label: "Season Arena — minimal duel sah agar berhak hadiah musim", bawaan: "8", ...angka(1000), lanjutan: true },
  { nama: "ARENA_MIN_MAIN_MINGGU", grup: "web", label: "Turnamen mingguan — minimal duel sah agar berhak hadiah", bawaan: "3", ...angka(1000), lanjutan: true },
  { nama: "ARENA_MIN_DETIK", grup: "web", label: "Season Arena — durasi minimal duel agar dihitung (detik)", bawaan: "25", ...angka(600), lanjutan: true },
  { nama: "ARENA_MAKS_PASANGAN", grup: "web", label: "Season Arena — maks duel yang dihitung antara 2 pemain yang sama per hari", bawaan: "3", ...angka(100), lanjutan: true },
  { nama: "ARENA_MAKS_HARI", grup: "web", label: "Season Arena — maks duel yang dihitung per pemain per hari", bawaan: "15", ...angka(1000), lanjutan: true, bantuan: "Pagar tambahan agar peringkat tak bisa dipompa lewat banyak akun boneka." },
  {
    nama: "KLAN_AKTIF", grup: "web", label: "Klan / tim (grup chat bersama, misi mingguan, papan peringkat)", bawaan: "1", saklar: true,
    cek: /^[01]$/, pesanCek: "Isi 1 (nyala) atau 0 (mati)",
    bantuan: "Pengguna bisa membuat/bergabung klan. Hadiah misi klan berupa poin toko (bukan uang tunai)."
  },
  { nama: "KLAN_MAKS_ANGGOTA", grup: "web", label: "Klan — maksimal anggota per klan", bawaan: "20", ...angka(100), lanjutan: true },
  { nama: "AUSTINPAY_SALDO_MIN", grup: "bayar", label: "AustinPay — kabari admin bila saldo di bawah (Rp; 0 = mati)", bawaan: "200000", ...angka(), lanjutan: true },
  { nama: "WD_PEMUTUS_MAKS", grup: "web", label: "Keamanan WD — matikan WD otomatis bila masalah penyedia ≥ (kali per 10 menit)", bawaan: "4", ...angka(100), lanjutan: true },
  { nama: "WD_AKUN_PER_NOMOR", grup: "web", label: "Keamanan WD — maks akun berbeda yang boleh menarik ke nomor e-wallet yang sama", bawaan: "2", ...angka(50), lanjutan: true },
  { nama: "WD_UMUR_AKUN_JAM", grup: "web", label: "Keamanan WD — akun baru boleh menarik setelah (jam sejak daftar)", bawaan: "1", ...angka(720), lanjutan: true },
  { nama: "WD_ALERT_RP", grup: "web", label: "Keamanan WD — kabari admin bila satu penarikan ≥ (Rp)", bawaan: "500000", ...angka(), lanjutan: true },
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
  {
    nama: "BLOKIR_IP_SAAT_BAN", grup: "web", label: "Ban akun: IP-nya ikut diblokir dari seluruh situs", bawaan: "1", saklar: true,
    cek: /^[01]$/, pesanCek: "Isi 1 (nyala) atau 0 (mati)",
    bantuan: "NYALA = saat akun di-ban (manual atau otomatis), semua IP yang pernah dipakai akun itu ikut diblokir dari situs; dibuka lagi otomatis saat akunnya dibuka. Catatan: IP ponsel/WiFi bersama bisa mengenai orang lain — blokir IP bisa dibuka di Admin → Pengguna & Blokir → IP Diblokir."
  },
  // ── Stor Gmail (freelance) ────────────────────────────────────────────────
  {
    nama: "SETORGMAIL_APIKEY", grup: "setor", label: "SetoranGmail — API key", rahasia: true, contoh: "sgp_xxxxxxxx",
    bantuan: "API key akun pemilik di setorangmail.web.id. Isi di sini (disimpan terenkripsi), JANGAN ditulis di kode/chat. Jika key pernah bocor, regenerate di dasbor SetoranGmail lalu isi yang baru."
  },
  { nama: "SETORGMAIL_BASE_URL", grup: "setor", label: "SetoranGmail — alamat API", bawaan: "https://setorangmail.web.id", ...url, lanjutan: true },
  {
    nama: "SETORGMAIL_AKTIF", grup: "setor", label: "Stor Gmail: buka untuk pengguna", bawaan: "1", saklar: true,
    cek: /^[01]$/, pesanCek: "Isi 1 (nyala) atau 0 (mati)",
    bantuan: "MATI = menu Stor Gmail tertutup untuk pengguna. Menu juga tertutup otomatis bila penyedia menutup semua room atau API-nya tidak bisa dihubungi."
  },
  {
    nama: "SETORGMAIL_UNTUNG_RP", grup: "setor", label: "Untung Anda per email (Rp) — dipotong dari harga room", bawaan: "1000", ...angka(),
    bantuan: "Contoh: harga room Rp4.000, untung Rp1.000 → pengguna dibayar Rp3.000 per email. Bisa diatur khusus per room di Admin → Stor Gmail."
  },
  { nama: "SETORGMAIL_MAKS_GENERATE", grup: "setor", label: "Stor Gmail — maks email per sekali generate", bawaan: "20", ...angka(50), lanjutan: true },
  { nama: "SETORGMAIL_MAKS_HARI", grup: "setor", label: "Stor Gmail — maks email di-generate per akun per hari", bawaan: "100", ...angka(), lanjutan: true },
  { nama: "SETORGMAIL_MAKS_MENUNGGU", grup: "setor", label: "Stor Gmail — maks email belum disetor per akun", bawaan: "60", ...angka(), lanjutan: true },
  {
    nama: "SETORGMAIL_BANK", grup: "setor", label: "SetoranGmail — bank/e-wallet pemilik (dikirim ke penyedia)", bawaan: "DANA", lanjutan: true,
    bantuan: "Penyedia mewajibkan tujuan pembayaran di tiap setoran. Isi dengan rekening/e-wallet MILIK ANDA (pemilik), bukan milik pengguna: pengguna dibayar dari saldo Stor di web ini."
  },
  { nama: "SETORGMAIL_REKENING", grup: "setor", label: "SetoranGmail — nomor rekening/e-wallet pemilik", bawaan: "", lanjutan: true },
  {
    nama: "SETORGMAIL_KREDIT_OTOMATIS", grup: "setor", label: "Kredit upah otomatis bila penyedia menyatakan setoran diterima", bawaan: "1", saklar: true,
    cek: /^[01]$/, pesanCek: "Isi 1 (nyala) atau 0 (mati)",
    bantuan: "NYALA = saldo pengguna bertambah begitu status dari penyedia masuk daftar 'status diterima'. MATI = semua upah menunggu persetujuan admin satu per satu."
  },
  {
    nama: "SETORGMAIL_STATUS_OK", grup: "setor", label: "Status penyedia yang dianggap DITERIMA (pisah koma)", bawaan: "approved,accepted,success,paid,done,verified,completed,selesai,diterima,berhasil", lanjutan: true,
    bantuan: "Cocokkan dengan status asli dari penyedia (lihat panel 'Status dari penyedia' di Admin → Stor Gmail). Status 'pending' tidak pernah dibayar."
  },
  { nama: "SETORGMAIL_STATUS_TOLAK", grup: "setor", label: "Status penyedia yang dianggap DITOLAK (pisah koma)", bawaan: "rejected,denied,declined,failed,invalid,refunded,ditolak,gagal,expired,canceled,cancelled", lanjutan: true },
  {
    nama: "WD_SETOR_AKTIF", grup: "setor", label: "Tarik saldo Stor ke e-wallet (otomatis via AustinPay)", bawaan: "1", saklar: true,
    cek: /^[01]$/, pesanCek: "Isi 1 (nyala) atau 0 (mati)"
  },
  { nama: "WD_SETOR_MIN_RP", grup: "setor", label: "Tarik saldo Stor — minimal diterima (Rp)", bawaan: "10000", ...angka(), lanjutan: true },
  { nama: "WD_SETOR_FEE_RP", grup: "setor", label: "Tarik saldo Stor — biaya admin per penarikan (Rp)", bawaan: "1000", ...angka(), lanjutan: true },
  { nama: "WD_SETOR_MAKS_HARI", grup: "setor", label: "Tarik saldo Stor — maks penarikan per akun per hari", bawaan: "5", ...angka(100), lanjutan: true },
  { nama: "WD_SETOR_MAKS_RP", grup: "setor", label: "Tarik saldo Stor — maks per penarikan (Rp)", bawaan: "1000000", ...angka(), lanjutan: true },
  // ── Keamanan otomatis (seluruh platform) ──────────────────────────────────
  {
    nama: "KEAMANAN_OTOMATIS", grup: "admin", label: "Keamanan otomatis: pemindaian berkala pola mencurigakan", bawaan: "1", saklar: true,
    cek: /^[01]$/, pesanCek: "Isi 1 (nyala) atau 0 (mati)",
    bantuan: "Tiap ±10 menit sistem memindai lonjakan OTP/deposit/transfer, saldo janggal, dan banyak akun satu perangkat; temuan dikabari ke Telegram admin."
  },
  {
    nama: "KEAMANAN_SUSPEND_OTOMATIS", grup: "admin", label: "Keamanan otomatis: bekukan akun yang jelas melanggar", bawaan: "1", saklar: true,
    cek: /^[01]$/, pesanCek: "Isi 1 (nyala) atau 0 (mati)",
    bantuan: "NYALA = temuan tingkat tinggi/kritis langsung membekukan akun (dibuka lewat tab Pengguna). MATI = hanya dikabari ke admin."
  },
  { nama: "KEAMANAN_TRANSFER_MAKS_JAM", grup: "admin", label: "Keamanan: batas jumlah transfer saldo per akun per jam sebelum ditandai", bawaan: "12", ...angka(500), lanjutan: true },
  { nama: "KEAMANAN_AKUN_PER_PERANGKAT", grup: "admin", label: "Keamanan: batas jumlah akun berbeda per perangkat/24 jam sebelum ditandai", bawaan: "4", ...angka(100), lanjutan: true },
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
