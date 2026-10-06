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
// Catatan khusus:
//   CRON_SECRET  bisa diisi dari web. Nilai dari web DAN dari env sama-sama
//                diterima rute cron (lihat lib/cronAuth.js): Vercel Cron tetap
//                jalan lewat env, cron eksternal pakai nilai dari web.
//   MONGODB_URI  punya alur sendiri (khusus: "dbUri") karena menyangkut
//                pindah database: diuji dulu, minta kode admin, dan tidak
//                lewat simpanCfg. Alamat dari env tetap dibutuhkan sebagai
//                "bootstrap" (lihat lib/db.js).
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
    nama: "CRON_SECRET", grup: "admin", label: "Rahasia cron", rahasia: true,
    bantuan:
      "Pelindung semua alamat /api/cron/*. Isi di sini untuk cron eksternal (cron-job.org, Cloudflare Cron Trigger, Netlify Scheduled Function): " +
      "panggil .../api/cron/tick?secret=NILAI_INI. CRON_SECRET di Environment Variables tetap diterima juga (Vercel Cron memakainya), " +
      "jadi untuk mengganti total, ubah dua-duanya. Mengganti nilai ini tidak mengeluarkan sesi admin ini. Kosong di dua tempat = endpoint cron terbuka."
  },
  {
    nama: "MONGODB_URI", grup: "admin", label: "Alamat database MongoDB", rahasia: true, khusus: "dbUri",
    bantuan:
      "Alamat dari Environment Variables dipakai untuk membuka database pertama kali (tempat konfigurasi ini disimpan). " +
      "Isi alamat lain di sini untuk memindahkan DATA (pengguna, saldo, pesanan) ke database tersebut. Data lama tidak ikut pindah otomatis."
  },

  // ── Penyedia nomor ────────────────────────────────────────────────────────
  { nama: "RUMAHOTP_APIKEY", grup: "otp", label: "RumahOTP — API key", rahasia: true, contoh: "otp_xxxxxxxx" },
  { nama: "WARUNGNOKOS_APIKEY", grup: "otp", label: "WarungNokos — API key", rahasia: true },
  {
    nama: "WARUNGNOKOS_V3_APIKEY", grup: "otp", label: "WarungNokos — API key khusus API baru (Server 2 / warkosv3), opsional", rahasia: true, lanjutan: true,
    bantuan: "Kosong = memakai API key WarungNokos di atas. Isi hanya bila dashboard WarungNokos menerbitkan key terpisah untuk 'Dokumentasi API Server 2' dan key biasa ditolak di sana."
  },
  { nama: "WARUNGNOKOS_BASE_URL", grup: "otp", label: "WarungNokos — alamat API", bawaan: "https://warungnokos.web.id", ...url, lanjutan: true },
  {
    nama: "WARUNGNOKOS_PISAH_SERVER", grup: "otp", label: "WarungNokos — pisahkan produk 'Server 1' dan 'Server 2'", bawaan: "1", saklar: true, lanjutan: true,
    cek: /^[01]$/, pesanCek: "Isi 1 (nyala) atau 0 (mati)",
    bantuan: "Kedua server WarungNokos memakai API baru (warkosv3), yang menamai pilihan harga 'Server 1', 'Server 2', … per negara. NYALA = Server Plus menampilkan produk 'Server 1' dan Server Express menampilkan produk 'Server 2' dst. MATI = keduanya menampilkan semua produk."
  },

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
  {
    nama: "DEPOSIT_RUTE_AKTIF", grup: "bayar", label: "Rute deposit otomatis (pembeli tidak memilih penyedia)", bawaan: "1", saklar: true,
    cek: /^[01]$/, pesanCek: "Isi 1 (nyala) atau 0 (mati)",
    bantuan: "NYALA = nominal ≥ batas diacak ke Pakasir / QRIS FAST (AustinPay); nominal di bawah batas ke WarungNokos. Pembeli tidak melihat pilihan penyedia. MATI = pembeli memilih metode sendiri seperti biasa. QRIS Manual tetap pilihan terpisah."
  },
  {
    nama: "MODE_BACA_SAJA", grup: "admin", label: "🚨 MODE BACA-SAJA DARURAT — hentikan semua transaksi uang", bawaan: "0", saklar: true,
    cek: /^[01]$/, pesanCek: "Isi 1 (nyala) atau 0 (mati)",
    bantuan: "NYALA = deposit baru, beli nomor, tarik saldo, transfer, tukar poin, dan game bertaruhan ditolak dengan pesan 'mode darurat'. Membaca (saldo, riwayat, chat) tetap jalan, dan uang yang SUDAH dibayar tetap dikreditkan (webhook/sapuan tidak diblokir). Pakai saat ada serangan, penyedia bermasalah, atau bug uang."
  },
  {
    nama: "DEPOSIT_UTAMA_AKTIF", grup: "bayar", label: "QRIS UTAMA — satu metode, penyedia diacak untuk SEMUA nominal", bawaan: "0", saklar: true,
    cek: /^[01]$/, pesanCek: "Isi 1 (nyala) atau 0 (mati)",
    bantuan: "NYALA = pembeli hanya melihat satu metode \"QRIS UTAMA\"; berapa pun nominalnya, penyedianya diacak dari daftar di bawah (WarungNokos, Pakasir, QRIS FAST, QRIS Manual). Mengalahkan rute per nominal di atas. Kalau yang terpilih QRIS Manual, pembeli mengunggah bukti transfer seperti biasa. MATI = kembali ke pengaturan sebelumnya."
  },
  { nama: "DEPOSIT_UTAMA_POOL", grup: "bayar", label: "QRIS UTAMA — daftar penyedia yang diacak (pisah koma)", bawaan: "warungnokos,pakasir,qrisfast,manual", lanjutan: true, bantuan: "Kunci: warungnokos, pakasir, qrisfast, manual, rumahotp, atlantic. BOBOT opsional dengan titik dua: pakasir:50,warungnokos:30,qrisfast:20 (peluang relatif; tanpa angka = rata). QRIS Manual otomatis dilewati saat tutup / belum disiapkan." },
  { nama: "KUNCI_AKUN_TUNDA_MENIT", grup: "web", label: "Kunci akun pengguna — masa tunggu buka kunci (menit; 0 = langsung)", bawaan: "60", ...angka(), lanjutan: true, bantuan: "Pemilik bisa mengunci akunnya sendiri. Membuka kunci baru berlaku setelah masa tunggu ini, supaya pencuri kode akun tidak bisa langsung membukanya." },
  { nama: "DEPOSIT_PENGINGAT_MENIT", grup: "bayar", label: "Pengingat QRIS hampir kedaluwarsa — berapa menit sebelum habis (0 = mati)", bawaan: "5", ...angka(), lanjutan: true, bantuan: "Pembeli dikabari lewat push web dan bot Telegram (kalau akunnya tersambung)." },
  { nama: "DEPOSIT_RUTE_BATAS_RP", grup: "bayar", label: "Rute deposit — batas nominal atas/bawah (Rp)", bawaan: "10000", ...angka(), lanjutan: true },
  { nama: "DEPOSIT_RUTE_MIN_RP", grup: "bayar", label: "Rute deposit — nominal minimum saat rute nyala (Rp)", bawaan: "1000", ...angka(), lanjutan: true },
  { nama: "DEPOSIT_RUTE_ATAS", grup: "bayar", label: "Rute deposit — penyedia untuk nominal ≥ batas (diacak; pisah koma)", bawaan: "pakasir,qrisfast", lanjutan: true, bantuan: "Kunci metode: pakasir, qrisfast, warungnokos, rumahotp, atlantic." },
  { nama: "DEPOSIT_RUTE_BAWAH", grup: "bayar", label: "Rute deposit — penyedia untuk nominal < batas (diacak; pisah koma)", bawaan: "warungnokos", lanjutan: true },
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
  // ── Duel permainan ────────────────────────────────────────────────────────
  // ── Game solo (Plinko, Mahjong Spin 1024) ─────────────────────────────────
  // ── Poin Game (saldo game: 2 poin = Rp1.000) ──────────────────────────────
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
  { nama: "AUSTINPAY_SALDO_MIN", grup: "bayar", label: "AustinPay — kabari admin bila saldo di bawah (Rp; 0 = mati)", bawaan: "200000", ...angka(), lanjutan: true },
  { nama: "WD_PEMUTUS_MAKS", grup: "web", label: "Keamanan WD — matikan WD otomatis bila masalah penyedia ≥ (kali per 10 menit)", bawaan: "4", ...angka(100), lanjutan: true },
  { nama: "WD_AKUN_PER_NOMOR", grup: "web", label: "Keamanan WD — maks akun berbeda yang boleh menarik ke nomor e-wallet yang sama", bawaan: "2", ...angka(50), lanjutan: true },
  { nama: "WD_UMUR_AKUN_JAM", grup: "web", label: "Keamanan WD — akun baru boleh menarik setelah (jam sejak daftar)", bawaan: "1", ...angka(720), lanjutan: true },
  { nama: "WD_ALERT_RP", grup: "web", label: "Keamanan WD — kabari admin bila satu penarikan ≥ (Rp)", bawaan: "500000", ...angka(), lanjutan: true },
  {
    nama: "BLOKIR_IP_SAAT_BAN", grup: "web", label: "Ban akun: IP-nya ikut diblokir dari seluruh situs", bawaan: "1", saklar: true,
    cek: /^[01]$/, pesanCek: "Isi 1 (nyala) atau 0 (mati)",
    bantuan: "NYALA = saat akun di-ban (manual atau otomatis), semua IP yang pernah dipakai akun itu ikut diblokir dari situs; dibuka lagi otomatis saat akunnya dibuka. Catatan: IP ponsel/WiFi bersama bisa mengenai orang lain — blokir IP bisa dibuka di Admin → Pengguna & Blokir → IP Diblokir."
  },
  // ── WEARTA CHAT ───────────────────────────────────────────────────────────
  // ── Stor Gmail (freelance) ────────────────────────────────────────────────
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
  },
  {
    nama: "REFERRAL_L2_PERSEN", grup: "lain", label: "Referral berjenjang — bonus level 2 (% dari bonus level 1)",
    bawaan: "0", ...angka(100), bantuan: "0 = mati. Contoh 20: saat A mengundang B dan B mengundang C, lalu C deposit pertama, B dapat bonus normal dan A dapat tambahan 20% dari bonus B. Hanya dibayar bila bonus B cair langsung (bukan yang ditahan penjaga anti-farming)."
  }
];


// ─────────────────────────────────────────────────────────────────────────────
// Penjelasan isian yang belum punya `bantuan` di daftar atas.
//
// Setiap penjelasan menjawab tiga hal yang membuat admin bingung saat melihat
// kolom kosong: ini untuk APA, harus diisi APA (format/satuan), dan DAPAT dari
// mana. Dipisah dari KONFIG supaya daftar utamanya tetap mudah dipindai, dan
// digabung di bawah — isian yang sudah punya `bantuan` sendiri tidak ditimpa.
const BANTUAN_TAMBAHAN = {
  // ── Penyedia nomor ──
  RUMAHOTP_APIKEY: "Untuk apa: kunci akun RumahOTP agar web bisa membeli nomor dan mengecek OTP lewat server 'Nokos Murah'. Isi: tempel API key dari akun RumahOTP kamu (menu API di dasbor mereka). Kosong = server itu tidak bisa dipakai.",
  WARUNGNOKOS_APIKEY: "Untuk apa: kunci akun WarungNokos untuk Server Plus & Server Express, sekaligus QRIS deposit WarungNokos. Isi: tempel API key dari dasbor WarungNokos. Kosong = kedua server itu tidak bisa dipakai.",
  WARUNGNOKOS_BASE_URL: "Alamat API WarungNokos. Biarkan KOSONG kecuali penyedia memberi tahu alamatnya pindah. Harus diawali https:// dan hanya domain.",

  // ── Pembayaran ──
  PAKASIR_PROJECT: "Untuk apa: menentukan proyek Pakasir tempat QRIS dibuat. Isi: 'slug' proyek persis seperti di dasbor Pakasir (huruf kecil, tanda hubung), contoh: nama-proyek.",
  PAKASIR_APIKEY: "Untuk apa: kunci rahasia proyek Pakasir. Isi: API key dari halaman proyek di dasbor Pakasir. Harus pasangan dari slug proyek di atas — kalau tidak cocok, QRIS gagal dibuat.",
  PAKASIR_MERCHANT_ID: "Opsional. Hanya dipakai tombol cek kesehatan Pakasir. Isi: merchant ID dari akun Pakasir. Boleh kosong.",
  PAKASIR_BASE_URL: "Alamat API Pakasir. Biarkan KOSONG kecuali Pakasir mengumumkan alamat baru. Harus diawali https:// dan hanya domain.",
  DEPOSIT_RUTE_BATAS_RP: "Garis pemisah rute deposit. Nominal SAMA DENGAN atau LEBIH BESAR dari angka ini memakai penyedia 'atas'; yang lebih kecil memakai penyedia 'bawah'. Isi: angka Rupiah tanpa titik, contoh: 10000.",
  DEPOSIT_RUTE_MIN_RP: "Nominal deposit paling kecil yang diterima saat rute otomatis menyala. Isi: angka Rupiah tanpa titik, contoh: 1000.",
  DEPOSIT_RUTE_BAWAH: "Penyedia yang diacak untuk nominal DI BAWAH batas. Isi: kunci penyedia dipisah koma, contoh: warungnokos. Kunci yang sah: pakasir, qrisfast, warungnokos, rumahotp, atlantic.",
  AUSTINPAY_BASE_URL: "Alamat API AustinPay (QRIS FAST). Biarkan KOSONG kecuali penyedia memberi alamat baru. Harus diawali https:// dan hanya domain.",
  ATLANTIC_BASE_URL: "Alamat API Atlantic H2H. Biarkan KOSONG kecuali penyedia memberi alamat baru. Harus diawali https:// dan hanya domain.",
  AUSTINPAY_SALDO_MIN: "Pengingat saldo. Kalau saldo AustinPay turun di bawah angka ini, admin dikabari lewat Telegram supaya sempat isi ulang sebelum penarikan otomatis gagal. Isi: Rupiah, 0 = tidak ada pengingat.",

  // ── Telegram ──
  TELEGRAM_BOT_TOKEN: "Untuk apa: bot yang mengirim notifikasi ke admin (order, deposit, penarikan, peringatan). Isi: token dari @BotFather, bentuknya 1234567890:AAH… Lalu kirim /start ke bot itu dari akun admin.",
  TELEGRAM_CHAT_ID: "Untuk apa: tujuan notifikasi admin. Isi: ID angka akun/grup Telegram admin (grup diawali tanda minus, contoh -100123…). Cara cari: kirim pesan ke @userinfobot atau @RawDataBot.",
  TELEGRAM_CHANNEL_ID: "Untuk apa: channel publik tempat pengumuman transaksi tampil. Isi: ID angka (-100…) atau @username channel. Bot notifikasi HARUS dijadikan admin channel. Kosong = pakai channel resmi bawaan.",
  TELEGRAM_OWNER_IDS: "Untuk apa: siapa yang boleh memakai perintah khusus owner di bot. Isi: ID angka Telegram, boleh lebih dari satu dipisah koma, contoh: 123456789,987654321.",
  TELEGRAM_WEBHOOK_SECRET: "Lanjutan. Kata sandi acak yang dipasang bersama webhook supaya hanya Telegram yang bisa mengirim ke alamat webhook. Isi: teks acak 16+ karakter (huruf/angka). Kosong = otomatis.",
  SHOP_BOT_TOKEN: "Untuk apa: bot toko tempat pembeli membeli nokos lewat Telegram. Isi: token dari @BotFather, bentuknya 1234567890:AAH… Ini bot BERBEDA dari bot notifikasi admin.",
  SHOP_BOT_WEBHOOK_SECRET: "Lanjutan. Pengaman webhook bot toko. Isi: teks acak 16+ karakter. Kosong = otomatis.",
  SHOP_BOT_OWNER_IDS: "Siapa yang jadi owner bot toko. Isi: ID angka Telegram dipisah koma. Kosong = memakai owner dari bot notifikasi.",
  TELEGRAM_MONITOR_CHAT_ID: "Lanjutan. Chat/grup tempat laporan kesehatan cron terkirim. Isi: ID angka atau @username. Biarkan bawaan kecuali kamu punya grup pemantau sendiri.",
  TELEGRAM_MONITOR_THREAD_ID: "Lanjutan. Nomor topik (thread) di grup pemantau. Isi: angka. Kosong/0 = pesan masuk ke obrolan utama grup.",

  // ── Game ──

  // ── Penarikan saldo nokos / stor ──
  WD_NOKOS_MIN_RP: "Penarikan saldo nokos paling kecil (nominal yang DITERIMA pengguna). Isi: Rupiah, contoh: 10000.",
  WD_NOKOS_FEE_RP: "Biaya admin tiap penarikan saldo nokos — pendapatan toko. Isi: Rupiah, contoh: 2000.",
  WD_NOKOS_MAKS_HARI: "Berapa kali satu akun boleh menarik per hari. Isi: angka, contoh: 5.",
  WD_NOKOS_MAKS_RP: "Nominal terbesar untuk SATU kali penarikan. Isi: Rupiah, contoh: 1000000.",
  WD_NOKOS_MAKS_RP_HARI: "Total nominal yang boleh ditarik satu akun dalam sehari. Isi: Rupiah, contoh: 3000000.",
  WD_PEMUTUS_MAKS: "Pemutus otomatis: kalau masalah dari penyedia penarikan terjadi sebanyak ini dalam 10 menit, penarikan otomatis dimatikan sendiri supaya uang tidak hilang. Isi: angka, contoh: 4.",
  WD_AKUN_PER_NOMOR: "Anti-curang: berapa akun BERBEDA yang boleh menarik ke nomor e-wallet yang sama. Isi: angka, contoh: 2.",
  WD_UMUR_AKUN_JAM: "Akun baru baru boleh menarik setelah sekian jam sejak daftar. Isi: jam, contoh: 1. 0 = langsung boleh.",
  WD_ALERT_RP: "Admin dikabari lewat Telegram kalau ada SATU penarikan sebesar ini atau lebih. Isi: Rupiah, contoh: 500000.",

  // ── Event & arena & klan ──

  // ── Stor Gmail ──

  // ── Keamanan ──
  KEAMANAN_TRANSFER_MAKS_JAM: "Pemindai keamanan menandai akun yang transfer saldo lebih dari ini dalam 1 jam. Isi: angka, contoh: 12.",
  KEAMANAN_AKUN_PER_PERANGKAT: "Pemindai menandai perangkat yang dipakai membuat akun berbeda sebanyak ini dalam 24 jam. Isi: angka, contoh: 4.",

  // ── Reseller ──
  RESELLER_SLOT_MAKS: "Slot bot tambahan terbanyak yang boleh dibeli satu reseller. Isi: angka, contoh: 5.",
  RESELLER_PREMIUM_HARI: "Lama paket Premium berlaku sejak dibeli. Isi: hari, contoh: 30.",
  RESELLER_PREMIUM_SLOT: "Tambahan slot bot yang didapat selama Premium aktif. Isi: angka, contoh: 2.",
  RESELLER_PREMIUM_MARKUP_MAKS: "Markup paling tinggi yang boleh dipasang reseller Premium. Isi: persen, contoh: 200.",
  RESELLER_PREMIUM_DISKON: "Tambahan potongan harga grosir untuk reseller Premium. Isi: persen, contoh: 1.",

  // ── Lainnya ──
  VAPID_SUBJECT: "Kontak yang dikirim bersama notifikasi push web. Isi: mailto:email@kamu.com atau alamat https:// web kamu."
};

for (const k of KONFIG) {
  if (!k.bantuan && BANTUAN_TAMBAHAN[k.nama]) k.bantuan = BANTUAN_TAMBAHAN[k.nama];
}

export const PETA = Object.fromEntries(KONFIG.map((k) => [k.nama, k]));

/** Isi yang mungkin dikirim dari luar: hanya nama yang ada di daftar, dan bukan hanyaEnv / khusus. */
export function bolehDiweb(nama) {
  const k = PETA[nama];
  return !!k && !k.hanyaEnv && !k.khusus;
}

/** Menyamarkan rahasia: cukup untuk mengenali, tidak cukup untuk memakainya. */
export function samarkan(nilai) {
  const s = String(nilai || "");
  if (!s) return "";
  return s.length > 10 ? `••••••••${s.slice(-4)}` : "••••••••";
}
