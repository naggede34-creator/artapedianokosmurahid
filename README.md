# Artapedia Web

Website nokos (nomor OTP via **RumahOTP**, **WarungNokos S1/S2**, dan **dibanana**) dengan deposit
saldo otomatis via **QRIS WarungNokos / Pakasir / RumahOTP**. Dibangun dengan Next.js, siap deploy ke Vercel.

## Pembaruan terbaru

### Fitur baru
- **Deposit QRIS WarungNokos** (`lib/warungnokos.js`, `app/api/deposit/*`). Admin bisa menyalakan/mematikan
  WarungNokos, Pakasir, dan RumahOTP satu per satu dari Dashboard Admin. WarungNokos tidak punya webhook
  deposit, jadi statusnya dicek lewat polling halaman deposit + cron.
- **Mutasi saldo lengkap** lewat koleksi `balance_logs` (`lib/ledger.js`): deposit, cashback, bonus
  referral, voucher, tukar poin, transfer, beli OTP, refund, dan koreksi admin.
- **Notifikasi Telegram lebih detail**: deposit menampilkan QRIS yang dipakai
  (WarungNokos/Pakasir/RumahOTP), ID & ref provider, biaya admin, total bayar, saldo sebelum/sesudah,
  deposit ke-berapa, dan lama pembayaran. Notif baru: transfer, deposit batal/kedaluwarsa,
  peringatan provider (mis. saldo provider kurang).
- Bot owner: perintah `/statuswarungnokos`.

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
kartu SIM, navigasi bawah (Beranda, Nokos, Deposit, Produk, Gratis), halaman Beranda,
Dashboard, Deposit, Riwayat (tab Nokos/Deposit), dan Mutasi yang baru.

## Setup WarungNokos

WarungNokos dipakai untuk **dua server nokos** sekaligus **deposit QRIS**. Dua
servernya adalah dua sistem API yang berbeda, bukan sekadar dua gateway:

| Di web | API WarungNokos | Bentuk order |
| --- | --- | --- |
| Server Plus | `/api/otp/*` (H2H utama) | `number_id` + `provider_id` + `operator_id` |
| Server Express | `/api/smscode/*` (Server2) | `product_id` + `app_id` + `country_id` |
| QRIS WarungNokos | `/api/deposit/*` | `amount` + `method` |

1. Login ke https://warungnokos.web.id, ambil **API Key** di menu Profil (formatnya `wn-...`).
2. Isi `WARUNGNOKOS_APIKEY` di Vercel → Project Settings → Environment Variables
   (untuk lokal ada di `.env.local`). **Jangan** ditulis di kode atau di-commit.
3. Isi saldo akun WarungNokos — deposit user dan pembelian nomor memakai saldo ini.
4. Cek koneksinya dari Dashboard Admin → Server OTP → **Diagnosa koneksi**
   (menampilkan saldo akun), atau kirim `/statuswarungnokos` ke bot owner.

Tidak ada whitelist IP, jadi aman dipakai langsung dari Vercel.

### Catatan soal `price_jual`

Endpoint order server utama meminta `price_jual` yang dokumentasinya disebut
"harga modal + markup Anda", sementara responsnya mengembalikan `amount` yang
sama persis dengan nilai yang dikirim. Karena tidak jelas apakah nilai itu yang
dipotong dari saldo WarungNokos, `lib/warungnokos.js` **selalu mengirim harga
modal dari pricelist**, bukan harga jual kita.

Markup ke user tetap dihitung sendiri di `lib/otpOrderService.js` memakai
pengaturan markup per server, jadi keuntungan tidak berkurang sama sekali —
yang dihindari adalah risiko saldo provider terpotong lebih besar dari semestinya.

### Batas yang perlu diingat

- Deposit: maksimal **3 transaksi pending** di sisi WarungNokos. Web ini juga
  membatasi 3 deposit pending per user, tapi batas WarungNokos berlaku untuk
  seluruh akun — kalau mentok, deposit user berikutnya akan ditolak.
- Cek status OTP: polling tiap 4–5 detik sesuai anjuran mereka.
- Deposit minimal Rp2.000.

Metode deposit `usdt-trc-20` juga tersedia di API mereka, tapi bentuk responsnya
tidak ada di dokumentasi yang dipegang, jadi belum dipasang. Kalau kamu punya
contoh responsnya, tinggal ditambahkan di `lib/warungnokos.js`.

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

### Catatan Pakasir API v2

Pakasir menghentikan API v1 pada **20 Oktober 2026**. Web ini sudah sepenuhnya
memakai v2:

| Fungsi | Endpoint v2 | Batas |
| --- | --- | --- |
| Buat transaksi | `POST /api/v2/create-transaction/{slug}/{order_id}` | 2 req/detik |
| Cek status | `GET /api/v2/transaction-status/{slug}/{txn_id}` | 1x / 4 detik per transaksi |
| Batalkan | `POST /api/v2/cancel-transaction/{slug}/{txn_id}` | 2 req/detik |
| Hitung biaya | `GET /api/v2/payment-fee/{amount}` | publik, tanpa API key |

API key dikirim lewat header `X-Api-Key`, bukan di body seperti v1. Semua batas
rate limit di atas sudah ditangani otomatis di `lib/pakasir.js` (antrean untuk
create/cancel, cache 4 detik untuk cek status).

Cek status dan pembatalan v2 memakai **`txn_id`**, bukan `order_id` + `amount`.
`txn_id` itu disimpan di dokumen deposit sebagai `pakasirTxnId` saat transaksi
dibuat. Deposit lama yang terlanjur dibuat sebelum migrasi tidak punya field itu,
jadi khusus deposit tersebut kode masih memakai endpoint v1 — aman sampai
20 Oktober 2026, dan setelah itu deposit lama pasti sudah tidak ada yang pending.

Halaman `/deposit` memakai `GET /api/v2/payment-fee/{amount}` supaya angka biaya
admin yang dilihat user adalah angka pasti, bukan estimasi persen. Kalau Pakasir
tidak bisa dihubungi, tampilannya otomatis kembali ke estimasi persen dari
pengaturan admin.

Env terkait:

| Variabel | Default | Fungsi |
| --- | --- | --- |
| `PAKASIR_BASE_URL` | `https://app.pakasir.com` | Ganti host kalau Pakasir memindahkannya |

## Bot Telegram toko (pembeli)

Bot terpisah dari bot owner. Pembeli bisa beli nokos, deposit, dan cek pesanan
langsung dari Telegram, memakai **saldo yang sama** dengan di web.

### Cara pasang

1. Buat bot di @BotFather, salin tokennya.
2. Isi di Vercel → Environment Variables:

```
SHOP_BOT_TOKEN=token-dari-botfather
SHOP_BOT_OWNER_IDS=5510813257
SHOP_BOT_WEBHOOK_SECRET=teks-acak-bebas
```

3. Pasang webhook-nya sekali (buka di browser):

```
https://domain-kamu.vercel.app/api/bot/setup?secret=ISI_CRON_SECRET
```

Cek statusnya dengan `?action=info`, lepas dengan `?action=delete`.
Pastikan **Site URL** sudah benar di Dashboard Admin → Pengaturan Situs,
karena deposit lewat bot memakai alamat itu.

### Cara kerjanya

| Menu bot | Yang terjadi |
| --- | --- |
| Beli Nokos | Hanya server yang menyala yang muncul. Yang dimatikan admin tidak terlihat sama sekali. |
| Deposit | Memanggil `/api/deposit/create` yang sama dengan web |
| Login | Menautkan chat Telegram ke kode akun web |
| Buat Akun | Membuat kode akun baru, tidak wajib — bisa juga login pakai kode dari web |
| Pesanan Saya | Riwayat + tombol cek OTP |
| Customer Service | Membuka chat ke username CS yang diatur admin |

**Saldo tidak pernah dihitung ulang di bot.** Order memakai `placeOtpOrder` dan
deposit memakai endpoint web, jadi tidak ada logika uang yang digandakan —
beli di bot atau di web, potongannya satu.

Daftar layanan & negara disimpan di sesi bot, dan tombolnya hanya mengirim nomor
urut. Ini bukan sekadar hemat: data callback Telegram dibatasi 64 byte, sementara
kode produk sebagian provider jauh lebih panjang dari itu.

### Notifikasi otomatis

User yang akunnya tertaut akan menerima pesan langsung di bot saat:
OTP masuk, deposit berhasil, dan saldo dikembalikan otomatis. Notifikasi ini
berjalan dari alur web juga — jadi order lewat web, kabarnya tetap masuk ke bot.

User baru (dari web maupun bot) tetap dilaporkan ke channel seperti sebelumnya.

### Admin bot

`/admin` membuka panel statistik, `/broadcast pesan` menyiarkan ke semua chat
yang pernah membuka bot. Keduanya hanya bisa dipakai id yang terdaftar di
`SHOP_BOT_OWNER_IDS`.

## Catatan penting soal Vercel Cron

Paket **Vercel Hobby hanya mengizinkan cron 1x sehari**. Kalau `vercel.json`
diisi jadwal yang lebih sering dari itu (mis. `0 1,5,9,13 * * *`), **seluruh
deployment akan GAGAL** dan web tidak akan pernah ter-update — tampilannya
terlihat seperti tidak berubah sama sekali.

Jadi jadwal di `vercel.json` harus tetap 1x sehari. Kalau mau `/api/cron/cleanup`
atau `/api/cron/stock-report` jalan lebih sering, pakai cron eksternal gratis
(cron-job.org, UptimeRobot) yang memanggil:

```
https://domain-kamu.vercel.app/api/cron/stock-report?secret=ISI_CRON_SECRET
```

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

## Server nokos: RumahOTP + WarungNokos + dibanana

Tombol "Pesan nomor" membuka pilihan server, dan **semua server memakai alur yang sama**:
pilih aplikasi → pilih negara → order.

- **Server Nokos Murah** → RumahOTP.
- **Server Plus** → WarungNokos H2H utama (`/api/otp/*`).
- **Server Express** → WarungNokos Server2 (`/api/smscode/*`).
- **OTP Fast Murah** → dibanana.

Admin bisa menyalakan/mematikan tiap server dari Dashboard Admin → Pengaturan → Server OTP,
tanpa deploy ulang.

Dua API WarungNokos memakai kunci order yang sama sekali berbeda, dan Server2
bahkan memisahkan daftar negara dari daftar produk. `lib/warungnokos.js`
menyeragamkan keduanya jadi satu field `key` per pilihan harga, sehingga alur
order, cek status, batal, dan ganti nomor tidak perlu tahu API mana yang dipakai.

Untuk Server2, daftar produk diambil sekali untuk seluruh negara
(`/products?platform_id=...` tanpa `country_id`) lalu dikelompokkan per negara —
dua panggilan, bukan satu panggilan per negara.

Pesanan WarungNokos disimpan dengan `server: "warungnokos_s1"` / `"warungnokos_s2"`
plus `countryId` dan `providerKey`.

File utama: `lib/warungnokos.js` (client dua API), `lib/otpServers.js` (daftar server),
`app/api/otp/services` & `app/api/otp/countries` (menerima `?server=`), `app/api/otp/order`
(routing per server), `lib/orderReconcile.js` (status/refund untuk semua provider).

Kalau ada yang gagal, buka Dashboard Admin → Server OTP → **Diagnosa koneksi**: tombol itu
menembak kedua server WarungNokos plus endpoint profil, lalu melaporkan saldo akun dan
penyebab kegagalannya.

