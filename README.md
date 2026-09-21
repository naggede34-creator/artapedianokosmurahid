# Artapedia Web

Website nokos (nomor OTP via RumahOTP), **suntik sosmed (SMM via Simuru)**, dan deposit saldo
otomatis via **QRIS Simuru / Pakasir / RumahOTP**. Dibangun dengan Next.js, siap deploy ke Vercel.

## Pembaruan terbaru

### Fitur baru
- **Deposit QRIS Simuru** (`lib/simuru.js`, `app/api/deposit/*`). Admin bisa menyalakan/mematikan
  Simuru, Pakasir, dan RumahOTP satu per satu dari Dashboard Admin. Simuru tidak punya webhook deposit,
  jadi statusnya dicek lewat polling halaman deposit + cron.
- **Suntik Sosmed** di halaman `/suntik` (`lib/smmService.js`, `app/api/smm/*`): pilih platform →
  kategori → layanan, isi link target & jumlah (atau daftar komentar untuk layanan custom comments).
  Harga jual = harga Simuru × (1 + markup%). Refund otomatis untuk pesanan batal (penuh) dan
  selesai sebagian (proporsional). Tombol refill untuk layanan bergaransi.
- **Mutasi saldo lengkap** lewat koleksi `balance_logs` (`lib/ledger.js`): deposit, cashback, bonus
  referral, voucher, tukar poin, transfer, beli OTP, refund, suntik, dan koreksi admin.
- **Notifikasi Telegram lebih detail**: deposit menampilkan QRIS yang dipakai (Simuru/Pakasir/RumahOTP),
  ID & ref provider, biaya admin, total bayar, saldo sebelum/sesudah, deposit ke-berapa, dan lama
  pembayaran. Notif baru: order & status suntik sosmed, transfer, deposit batal/kedaluwarsa,
  peringatan provider (mis. saldo Simuru kurang).
- Bot owner: perintah baru `/saldosimuru`.

### Perbaikan bug
- **Celah harga OTP**: dulu harga dasar dikirim dari browser (bisa diubah jadi 0). Sekarang harga
  selalu diambil ulang dari RumahOTP di server, dan saldo dipotong sebelum pesan ke provider.
- **Celah batal OTP**: sebelum refund, status dicek dulu ke provider sehingga tidak bisa dapat kode
  sekaligus refund. Kode OTP yang telat masuk pada pesanan yang sudah direfund tidak ditampilkan.
- Bonus referral sekarang cair dari jalur mana pun (polling, webhook, cron), bukan hanya webhook.
- Deposit yang dibayar setelah dibatalkan / kedaluwarsa tetap dikreditkan oleh cron (3 jam).
- Logika kredit deposit disatukan di `lib/depositService.js` (tidak ada lagi duplikasi yang beda perilaku).
- Teks dinamis di notif Telegram di-escape (dulu karakter `<` bikin notif gagal terkirim).
- Pencarian user admin aman dari regex error; ID pengumuman/broadcast divalidasi.
- Urutan "Rate" di pilih negara OTP sebelumnya tidak berfungsi.
- Animasi CSS yang keyframes-nya hilang, zona waktu WIB di statistik harian, transfer desimal,
  pembuatan dokumen settings ganda saat request bersamaan.
- Laporan cron hanya dikirim kalau ada hal penting (tambahkan `&report=1` untuk memaksa).

### Tampilan
Desain ulang: font Plus Jakarta Sans + JetBrains Mono (untuk kode OTP/akun), kartu saldo bergaya
kartu SIM, navigasi bawah 5 tab (Beranda, Nokos, Deposit, Suntik, Riwayat), halaman Beranda,
Dashboard, Deposit, Suntik, Riwayat (tab Nokos/Suntik/Deposit), dan Mutasi yang baru.

## Setup Simuru

1. Login ke https://simuru.com, ambil API key di halaman API.
2. Isi `SIMURU_APIKEY` di Vercel → Project Settings → Environment Variables (untuk lokal sudah ada
   di `.env.local`). **Jangan** menulis API key di kode atau meng-commit-nya.
3. Isi saldo akun Simuru kamu — deposit user masuk ke saldo Simuru ini, dan pesanan suntik memakai
   saldo yang sama. Pantau saldonya di Dashboard Admin atau lewat `/saldosimuru` di bot owner.
4. Simuru membatasi 5 QRIS pending per API key. Kalau sedang ramai, user diminta mencoba lagi
   atau memilih metode lain.

## Catatan redesain sebelumnya

- **Palet warna baru**: biru, biru tua (navy), putih, silver, hitam — menggantikan
  aksen pink/teal versi sebelumnya. Semua warna kini dibaca dari CSS variable di
  `app/globals.css` (`:root` untuk mode terang, `.dark` untuk mode gelap), jadi
  mengubah brand di masa depan cukup edit satu file itu.
- **Mode terang/gelap**: tombol sakelar (`components/ThemeToggle.js`) tersedia di
  Navbar, Sidebar, dan menu akun. Default-nya selalu **terang**, pilihan user
  disimpan di `localStorage` dan langsung diterapkan lagi di kunjungan berikutnya
  tanpa kedipan (lihat skrip inline di `app/layout.js`).
- **Sidebar menu** (`components/Sidebar.js`) baru berisi: Dashboard, Order OTP
  Utama/Kedua, Deposit Saldo, Transfer Saldo, Mutasi Saldo, Riwayat Transaksi,
  Daftar Harga, Pusat Informasi, Bantuan (FAQ), dan link Docs Server 1/2 — dibuka
  lewat ikon hamburger di Navbar.
- **Halaman baru**:
  - `/dashboard` — ringkasan saldo, statistik (total transaksi, OTP berhasil,
    deposit sukses), grafik order & spending 30 hari, dan peringkat 10 user
    dengan pesanan sukses terbanyak.
  - `/harga` — Daftar Harga per aplikasi & negara.
  - `/informasi` — Pusat Informasi dengan tab Pengumuman/Kotak Masuk (konten
    pengumuman ada di `lib/announcements.js`, edit manual — belum tersambung DB).
  - `/faq` — Bantuan (FAQ) dengan pencarian, langkah cara order, kebijakan
    refund, dan accordion pertanyaan umum.
  - `/transfer` — Transfer Saldo antar akun (API: `app/api/transfer/route.js`).
  - `/mutasi` — Mutasi Saldo, gabungan riwayat deposit masuk & pemakaian OTP
    keluar.
- **API baru**: `app/api/user/stats/route.js` (statistik dashboard per akun) dan
  `app/api/leaderboard/orders/route.js` (peringkat berdasarkan pesanan OTP
  sukses).

Catatan penting: fitur "Order Akun Telegram" (stok akun fake/scam/polosan) dari
source bot lama SENGAJA TIDAK dipindahkan ke web ini.

## 1. Siapkan MongoDB Atlas (gratis)

1. Buat akun di https://www.mongodb.com/cloud/atlas dan buat cluster gratis (M0).
2. Buat database user (username & password).
3. Di Network Access, tambahkan `0.0.0.0/0` supaya Vercel bisa konek (atau IP Vercel spesifik).
4. Salin connection string, bentuknya seperti:
   `mongodb+srv://user:password@cluster.mongodb.net/artapedia`

## 2. Siapkan akun Pakasir

1. Daftar/login di https://pakasir.com, buat Project baru.
2. Catat **Project Slug** dan **API Key** dari halaman detail project.
3. Di pengaturan project, isi **Callback URL** dengan:
   `https://domain-kamu.vercel.app/api/deposit/webhook`
   (isi setelah web sudah live di Vercel, lalu update lagi kalau domain berubah)

## 3. Siapkan akun RumahOTP

1. Daftar/login di https://www.rumahotp.io
2. Ambil API Key di menu Profile → Developer.
3. Pastikan saldo akun RumahOTP kamu cukup, karena setiap pembelian nomor oleh
   user di web akan memotong saldo RumahOTP kamu di belakang layar.
4. RumahOTP juga dipakai sebagai metode QRIS otomatis KEDUA untuk halaman
   `/deposit` (selain Pakasir) — lihat "Deposit QRIS ganda" di bawah.

## Deposit QRIS ganda (Pakasir + RumahOTP)

- Halaman `/deposit` sekarang mendukung dua metode QRIS otomatis: **Pakasir**
  dan **RumahOTP** (`GET /v2/deposit/create`, `/v2/deposit/get_status`,
  `/v1/deposit/cancel` di `lib/rumahotp.js`, mengikuti Developer Docs resmi
  RumahOTP). Tidak ada opsi crypto/USDT yang ditampilkan ke user — sengaja
  cuma QRIS.
- Admin bisa nyalakan salah satu, dua-duanya, atau matikan semua metode
  sementara dari **Dashboard Admin** tanpa deploy ulang, plus atur persen
  biaya admin per metode yang ditampilkan sebagai estimasi ke user sebelum
  bayar (nominal pasti yang dipotong tetap mengikuti respons resmi provider
  saat transaksi dibuat).
- Alur halaman deposit (Jumlah → Metode → Konfirmasi → Payment) sengaja dibuat
  mirip tampilan RumahOTP sendiri: nominal cepat dengan label (Hemat/Populer/
  Rekomen/Juragan/Bosman/VVIP), kartu "Detail Pembayaran", QR + countdown
  waktu kedaluwarsa, serta tombol Download/Batalkan/"Saya sudah membayar".
- Kalau ternyata nama field respons RumahOTP (biaya admin, total pembayaran,
  ID transaksi, dst.) sedikit beda dari dugaan di kode, cukup sesuaikan daftar
  nama field di `pickField(...)` pada `app/api/deposit/create/route.js` dan
  `app/api/deposit/status/route.js` — tidak perlu ubah tempat lain.

## 4. (Opsional) Notifikasi Telegram

Kalau mau ada notif otomatis ke channel/grup Telegram setiap ada deposit pending,
deposit sukses, dan pembelian nomor OTP/nokos:

1. Chat @BotFather di Telegram, buat bot baru, catat token-nya.
2. Tambahkan bot itu jadi **admin** di channel/grup tujuan notif.
3. Ambil `chat_id` channel/grup itu (bisa pakai `@username_channel` kalau publik,
   atau angka `-100xxxxxxxxxx` kalau privat — cek pakai bot seperti @userinfobot).
4. Isi `TELEGRAM_BOT_TOKEN` dan `TELEGRAM_CHAT_ID` di environment variables.
5. Isi `TELEGRAM_ADS_LINK` dengan link promo yang mau ditampilkan di setiap notif
   (contoh: link ke channel jualan nokos kamu), dan `TELEGRAM_ADS_TEXT` untuk teks
   linknya kalau mau beda dari default.

Kalau dua variabel `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID` dikosongkan, notifikasi
otomatis nonaktif dan tidak akan mengganggu transaksi deposit/pembelian.

Catatan keamanan: kode akun user di notif ini sengaja disamarkan (misal `abcd••••wxyz`)
supaya kode akun lengkap tidak bocor ke orang lain yang ada di channel/grup.

## 5. Jalankan lokal (opsional, untuk tes sebelum deploy)

```
npm install
cp .env.example .env.local
# isi semua nilai di .env.local
npm run dev
```

Buka http://localhost:3000

## 6. Deploy ke Vercel

1. Push folder ini ke repository GitHub/GitLab.
2. Buka https://vercel.com → New Project → import repo tersebut.
3. Di bagian Environment Variables, isi semua variabel dari `.env.example`:
   - `MONGODB_URI`
   - `PAKASIR_PROJECT`
   - `PAKASIR_APIKEY`
   - `RUMAHOTP_APIKEY`
   - `DEPOSIT_MIN_AMOUNT` (contoh: 2000)
   - `DEPOSIT_MAX_AMOUNT` (contoh: 1000000)
   - `OTP_MARKUP_PERCENT` (contoh: 0, atau isi angka kalau mau ambil untung dari harga RumahOTP — bisa diubah lagi kapan saja lewat Dashboard Admin tanpa deploy ulang)
   - `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TELEGRAM_ADS_LINK`, `TELEGRAM_ADS_TEXT` (opsional, lihat bagian 4)
   - `ADMIN_CODE` (kode rahasia untuk masuk Dashboard Admin, default `arta12123` kalau tidak diisi — sangat disarankan ganti sendiri)
   - `TELEGRAM_CHANNEL_1`, `TELEGRAM_CHANNEL_2` (opsional, link channel yang ditampilkan di notifikasi Telegram & tombol "Channel Info"/"Group Diskusi" di web — default sudah diisi link channel kamu)
   - `NEOXR_API_KEY` (opsional, apikey untuk fitur CS AI di pojok kanan bawah web — kalau tidak diisi, otomatis pakai apikey default yang sudah ditanam di kode)

## Fitur CS AI & tombol bantuan

- Tombol bulat di pojok kanan bawah (semua halaman publik) membuka 3 pilihan: **Tanya CS AI**,
  **Channel Info**, dan **Group Diskusi**.
- **Channel Info** & **Group Diskusi** mengarah ke link Telegram di `TELEGRAM_CHANNEL_1` /
  `TELEGRAM_CHANNEL_2` (lihat di atas) — ganti env var itu kalau link channel kamu berubah.
- **Tanya CS AI** membuka jendela chat yang memanggil `app/api/cs/route.js`, yang meneruskan
  pertanyaan user ke API GPT-4 pihak ketiga (`https://api.neoxr.eu/api/gpt4`, lihat `lib/neoxr.js`)
  lengkap dengan konteks singkat tentang cara kerja Artapedia (deposit, beli OTP, refund, dll),
  supaya jawabannya relevan. AI ini **tidak** bisa melihat data akun/saldo user secara langsung —
  untuk kendala yang butuh data spesifik, arahkan user ke Channel Info/Group Diskusi.
- Karena mengandalkan API pihak ketiga gratis, sebaiknya pantau kestabilannya; kalau API tidak
  merespons, widget akan menampilkan pesan error dan menyarankan hubungi admin manual.

### Dashboard Admin

- Buka web, scroll ke paling bawah, klik teks "ARTA PEDIA iD" di baris copyright — ini gerbang masuk ke `/admin/login`.
- Masukkan kode admin (`ADMIN_CODE`, default `arta12123`).
- Di dashboard bisa: ubah markup harga jual OTP, nyalakan/matikan mode maintenance (menutup seluruh web dari user biasa), lihat daftar user + total saldo beredar, serta tambah/kurangi saldo user manual (otomatis terkirim notifikasi detail ke channel Telegram).
4. Klik Deploy.
5. Setelah dapat domain (mis. `artapedia.vercel.app`), buka Pakasir dashboard dan
   set Callback URL project ke `https://artapedia.vercel.app/api/deposit/webhook`.

## Struktur fitur

- `/` — Halaman utama
- `/deposit` — Deposit saldo otomatis via QRIS (Pakasir)
- `/otp` — Beli nomor OTP untuk semua layanan (RumahOTP), alur: pilih layanan →
  negara → operator → konfirmasi → nomor aktif & kode OTP realtime (polling)
- `/riwayat` — Riwayat deposit & pembelian OTP
- `/cara-pakai` — Panduan penggunaan
- `/syarat` — Syarat & Ketentuan
- `/referral` — Program undang teman, tampilkan link & bonus referral user

## Bot Telegram untuk Owner

Owner bisa kontrol saldo user & lihat data langsung dari chat Telegram, tanpa buka database.

**1. Siapkan bot & env var**

- Kalau belum punya bot, buat lewat [@BotFather](https://t.me/BotFather), ambil tokennya.
- Isi `TELEGRAM_BOT_TOKEN` di env (boleh pakai bot yang sama dengan notifikasi channel, boleh beda).
- Chat bot kamu sekali (kirim `/start`), lalu buka
  `https://api.telegram.org/bot<TOKEN>/getUpdates` di browser untuk lihat `chat.id` kamu.
- Isi `TELEGRAM_OWNER_IDS` dengan chat_id tadi (pisahkan koma kalau owner lebih dari satu).
  Hanya chat_id yang terdaftar di sini yang bisa menjalankan perintah bot.
- Isi `TELEGRAM_WEBHOOK_SECRET` bebas dengan string acak (opsional tapi disarankan).

**2. Daftarkan webhook ke Telegram** (jalankan sekali setelah deploy, ganti domain & token):

```
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://domainkamu.vercel.app/api/telegram/webhook&secret_token=<isi_sama_dengan_TELEGRAM_WEBHOOK_SECRET>"
```

**3. Perintah yang tersedia** (kirim ke bot dari akun owner):

- `/addsaldo TOKEN NOMINAL` — tambah saldo user, contoh `/addsaldo AP-1234-ABCD-5678 10000`
- `/kurangisaldo TOKEN NOMINAL` — kurangi saldo user
- `/cekuser TOKEN` — lihat detail satu user (saldo, referral, tanggal daftar)
- `/listuser [halaman]` — daftar user terbaru, 10 per halaman
- `/statistik` — ringkasan total user, total saldo beredar, dan total bonus referral
- `/help` — tampilkan menu perintah

Chat_id yang tidak terdaftar di `TELEGRAM_OWNER_IDS` akan diabaikan begitu saja
(bot tidak membalas apa pun), supaya panel ini tidak "bocor" ke orang lain.

## Program undang teman (referral)

- Tiap user, kode akunnya sendiri sekaligus jadi kode referral. Link undangannya
  ditampilkan di halaman `/referral`, formatnya `https://domainkamu.com/?ref=KODE_AKUN`.
- Saat orang baru buka link itu, akun barunya otomatis tertaut sebagai "diundang oleh"
  pemilik kode tersebut (tersimpan di field `referredBy`).
- Begitu user yang diundang itu **berhasil deposit untuk pertama kalinya**, pengundang
  otomatis dapat bonus saldo sebesar `REFERRAL_BONUS_PERCENT`% dari nominal deposit
  tersebut (diproses di `app/api/deposit/webhook/route.js`). Bonus hanya cair sekali
  per user yang diundang, supaya tidak bisa disalahgunakan dengan deposit berkali-kali.
- Set `REFERRAL_BONUS_PERCENT=0` di env kalau ingin menonaktifkan program ini sementara.

## Sistem akun tanpa login

Setiap pengunjung baru otomatis mendapat kode akun unik (`AP-XXXX-XXXX-XXXX`)
yang disimpan di localStorage browser dan menjadi kunci ke saldo & riwayat.
Tidak ada password. Kalau ingin menambah fitur "masuk dari perangkat lain",
tinggal tambahkan form input kode akun yang memanggil `/api/user/init` dengan
body `{ token: "AP-...." }`.

## Keamanan yang sudah diterapkan

- Webhook Pakasir diverifikasi ulang ke API `transactiondetail` sebelum saldo
  ditambahkan, supaya webhook palsu tidak bisa mengisi saldo.
- Saldo dipotong baru setelah order OTP berhasil dibuat di RumahOTP (bukan
  sebelum), memakai operasi atomik `$inc` dengan syarat saldo cukup.
- Semua API key (Pakasir, RumahOTP) hanya dipakai di server (API routes), tidak
  pernah dikirim ke browser.

## VirtuSIM: deposit QRIS + server "Nokos OTP Fast"

Isi `VIRTUSIM_APIKEY` di environment (lokal: `.env.local`, Vercel/Netlify: Environment
Variables), lalu deploy ulang. Satu key dipakai untuk dua fitur:

1. **Deposit** — metode baru "QRIS VirtuSIM" muncul di halaman Deposit (bisa
   di-on/off-kan + diatur biaya adminnya dari Dashboard Admin, sama seperti metode
   lain). Status dicek lewat polling & cron, saldo hanya dikreditkan kalau VirtuSIM
   menjawab status lunas yang jelas.
2. **Pesan nomor** — tombol "Pesan nomor" sekarang membuka pilihan server:
   - **Server Nokos Murah** → RumahOTP (alur lama: aplikasi → negara → server).
   - **Server Nokos OTP Fast** → VirtuSIM, negara Indonesia (`VIRTUSIM_COUNTRY`),
     daftar layanan dengan WhatsApp selalu paling atas.

File utama: `lib/virtusim.js` (client API), `lib/otpServers.js` (daftar server),
`app/api/otp/vs/services` & `app/api/otp/vs-order` (beli nomor OTP Fast),
`lib/orderReconcile.js` (status/refund untuk kedua provider).

Pesanan VirtuSIM disimpan dengan `provider: "virtusim"` dan `orderId` berawalan `VS`.
Batal setelah 3 menit, refund otomatis kalau kedaluwarsa, dan Ganti Nomor bekerja sama
seperti server murah.

**Catatan penting:** dokumentasi VirtuSIM yang dipakai saat integrasi hanya memuat
`list_country`, `list_operator`, `active_order`, `order`, dan `reactive_order`. Nama action
lain (`services`, `status`, `set_status`, `deposit`, `deposit_status`, `deposit_cancel`)
memakai nama umum dan semuanya ada di objek `ACTIONS` di `lib/virtusim.js` — bisa diganti
lewat env `VIRTUSIM_ACTION_*` tanpa ubah kode. Cocokkan dengan dokumentasi Postman
VirtuSIM (bagian Service / Transaction / Deposit), lalu **tes deposit kecil (mis. Rp2.000)
dan satu pembelian nomor** sebelum dibuka ke user.
