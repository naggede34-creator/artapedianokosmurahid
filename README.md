# Artapedia Web

Website deposit saldo otomatis (QRIS via Pakasir) dan pembelian nomor OTP untuk
semua layanan (via RumahOTP), dibangun dengan Next.js dan siap deploy ke Vercel.
Tidak memakai bot Telegram — website ini berdiri sendiri.

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
   - `OTP_MARKUP_PERCENT` (contoh: 0, atau isi angka kalau mau ambil untung dari harga RumahOTP)
   - `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TELEGRAM_ADS_LINK`, `TELEGRAM_ADS_TEXT` (opsional, lihat bagian 4)
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
