# Artapedia — nokos, QRIS gateway, Saldo Kaget & WEARTA CHAT

Website **beli nomor OTP (nokos)**, **QRIS gateway** untuk reseller/developer, **Saldo Kaget**
(bagi saldo ke teman lewat tautan), dan **WEARTA CHAT** (chat ala WhatsApp). Dibangun dengan Next.js 15
(App Router) + React 19 + MongoDB, tema komik 3D, bisa dipasang sebagai PWA.

## Fitur

**Pengguna**
- **Beli nokos** — server WarungNokos (Server 1 & 2), RumahOTP, dan dibanana (server yang kunci API-nya belum
  diisi otomatis tersembunyi). Pilih layanan → negara → beli, OTP masuk otomatis, ganti nomor, batalkan &
  refund otomatis kalau OTP tidak datang, garansi.
- **Deposit** — QRIS otomatis (WarungNokos, Pakasir, RumahOTP, Atlantic, QRIS FAST/AustinPay) dan QRIS manual
  + OCR bukti transfer. Rute deposit diacak/berbobot oleh admin.
- **Cashback bertingkat** (`/cashback`) — persen dasar + tambahan **tingkat** (Bronze–Platinum, dari total belanja
  nokos) + tambahan **deposit besar** + bonus event musiman, dengan batas persen & rupiah. Rumusnya satu
  (`lib/cashbackHitung.js`) dan dipakai server, halaman Cashback, halaman Deposit, dan pratinjau admin.
- **Saldo Kaget** (`/kaget`) — buat paket saldo untuk N orang (dibagi **acak** atau **rata**, pesan, masa
  berlaku), bagikan satu tautan (WhatsApp/Telegram/salin), siapa cepat dia dapat. Satu klaim per akun,
  pembuat tidak bisa mengambil paketnya sendiri, daftar penerima dengan label "paling beruntung", notifikasi
  & push, riwayat dibuat/diterima, tutup dini, dan **sisa yang tidak terambil kembali otomatis**. Saldo hasil
  Kaget adalah saldo biasa (tidak bisa ditarik/ditransfer). Detail teknis di bawah.
- **QRIS Gateway** untuk merchant (`/gateway`, tombolnya di bilah atas tepat di samping Beranda): tagihan QRIS
  lewat **AustinPay** (biaya Rp250 per tagihan), saldo masuk otomatis, callback ke merchant bertanda tangan
  HMAC, dan **penarikan ke e-wallet otomatis lewat AustinPay** (minimal Rp10.000 yang ditarik, biaya Rp1.000
  dipotong dari nominal itu: tarik Rp10.000 → e-wallet menerima Rp9.000). Kalau AustinPay bermasalah berulang, penarikan otomatis mati sendiri dan permintaan masuk
  antrean manual admin.
- **Undang teman**, **Pembeli Terbanyak** (mingguan), **Giveaway**, voucher, transfer saldo, riwayat & mutasi,
  Saldo Gratis (job), Stor Gmail (setor akun Gmail → upah, dengan penarikan otomatis), Toko Produk, Bot Reseller,
  program kreator, flash sale, jam diskon, event musiman otomatis.
- **WEARTA CHAT** — chat pribadi & grup, status, panggilan suara/video, lencana verifikasi, WEARTA AI.
- **API Key + dokumentasi** untuk nokos dan QRIS gateway (`/api-docs`, `/gateway/docs`).
- **Notifikasi** ke channel Telegram, bot utama, dan bot reseller.

**Admin** (`/admin`)
- Pengguna & blokir, saldo, koreksi, keamanan & IP/perangkat ganda, rute deposit, provider, harga & markup,
  server nokos, voucher, broadcast, banner, popup & pembaruan, tiket bantuan, laporan stok, backup, konfigurasi
  terenkripsi, izin per peran admin, **Saldo Kaget** (pantau & tutup paksa), **Cashback** (tingkat, bonus
  nominal, batas), QRIS Gateway & AustinPay.

## Nama web bisa diganti
Bawaannya **Arta Pedia**. Admin → Pengaturan Umum → **Nama & merek** mengubah nama situs, akhiran (ID), slogan, nama
maskot, dan nama fitur chat tanpa deploy ulang; kosong = kembali ke bawaan. Berlaku di judul tab, manifest PWA,
navigasi, sapaan maskot, halaman syarat/panduan, dan bot toko. Satu sumber: `lib/brand.js` (`useBrand()` di klien,
`ambilBrand()` di server).

**Logo** juga bisa diunggah dari Admin → Pengaturan Umum → 🎨 Logo (logo lebar + logo ikon persegi); tanpa unggahan
memakai berkas bawaan di `public/`. Disajikan lewat `/api/logo/<jenis>` (`lib/logo.js`). Gambar bawaan di bot Telegram
(`bot-welcome.jpg`) tetap berkas.

## Web Reseller
Menu **Web Reseller** (`/web-reseller`): satu akun = satu web. Pengguna memilih nama web (alamat), nama brand, dan markup %.
Web itu memuat aplikasi yang sama dengan web utama tetapi bermerek & berharga sendiri; pengunjung tidak dialihkan.
- **Alamat**: `nama.domainmu.com` bila admin mengisi `RW_DOMAIN_ROOT` dan memasang domain wildcard `*.domainmu.com`
  (Vercel + DNS); tanpa itu dipakai `/r/nama` di domain utama, yang mengingat pilihan di **sessionStorage tab itu saja** (bukan cookie), sehingga tab lain tetap web utama. Pengenal web ditentukan **server** dari host / header `x-rw`
  (`lib/rwKonteks.js`), tidak pernah dari isi permintaan.
- **Uang**: pembeli membayar harga situs + markup; markup = komisi. Komisi tertunda saat pesanan dibuat, cair ke dompet
  gateway pemilik saat OTP masuk (idempoten), ditarik kembali bila direfund (`lib/webReseller.js`).
- **Tarik komisi**: otomatis ke e-wallet lewat AustinPay (jalur `lib/gatewayWd.js`), minimal Rp11.000, biaya Rp1.000 dipotong dari nominal.
- **Fitur di web reseller**: hanya beli nokos, deposit, riwayat transaksi, dan mutasi saldo (+ beranda ringkas, profil/kode akun,
  syarat). Menu, dasbor, banner, popup, dan halaman lain disaring (`lib/rwHalaman.js`); membuka halaman fitur lain dialihkan ke
  `/dashboard` web reseller itu sendiri, tidak pernah ke web utama.
- **Tampilan web reseller**: tema biru–putih–silver–biru muda dengan gaya "bersih" (rata & simpel), dipasang server-side
  (`<html data-tema="rw" data-gaya="bersih">`, CSS di akhir `app/globals.css`); tanpa maskot elang, komik pembuka, banner promosi web
  utama, dan asisten AI; hanya tombol bantuan ke Customer Service. Pilihan tema pengguna tidak menimpanya.
- **Syarat & Ketentuan Web Reseller** (`SYARAT_RW` di `lib/webResellerUi.js`) tampil di menu Web Reseller dan wajib disetujui sebelum
  membuat web (disimpan `syaratSetujuAt`).
- **Statistik**: kunjungan, pesanan, omzet, komisi, grafik 14 hari, pesanan terbaru. Admin: kartu Web Reseller di Pengaturan Umum
  (pantau & bekukan); saklar/markup maks di Konfigurasi (`RW_*`).

## Yang sengaja tidak ada
Semua fitur **game** (duel, game solo, Arena Pendekar), **poin** & Toko Poin, **misi & tantangan**, **Pet Arta
Pedia**, **klan**, **bonus** (check-in, welcome, winback, spin/scratch/mystery box), VIP/loyalitas berbasis poin,
dan **penarikan saldo nokos/game** ke e-wallet. Hanya saldo hasil **Stor Gmail**, saldo **gateway merchant**, dan
penarikan oleh admin yang bisa ditarik. Versi sebelum perubahan ini ada di branch `cadangan-sebelum-rombak`.

## Saldo Kaget — cara kerja uangnya
- Pembuat membayar total (+ biaya admin, bawaan 0%) di muka; saldo dipotong atomik dan **ditahan di paket**.
- Bagian tiap penerima dihitung saat paket dibuat dan disimpan **tersembunyi** di server (tidak pernah dikirim
  ke halaman). Jumlah semua bagian persis sama dengan total.
- Klaim: indeks unik `(kid, token)` → satu klaim per akun; slot diambil dengan `findOneAndUpdate` atomik; kredit
  dicatat dulu di buku besar dengan referensi unik, baru saldo ditambah (klik ganda/retry tidak bisa dobel).
- Paket berakhir (masa berlaku / ditutup pembuat / ditutup admin) → sisa dikembalikan tepat satu kali oleh
  penyapu `sapuKaget()` (dipanggil `/api/cron/tick`) atau langsung saat ditutup. Klaim/pengembalian yang
  tertinggal karena proses mati diselesaikan penyapu.
- Pengaturan (Admin → Konfigurasi, grup Website): `KAGET_AKTIF`, `KAGET_MIN_TOTAL`, `KAGET_MAKS_TOTAL`,
  `KAGET_MIN_PER_ORANG`, `KAGET_MAKS_PENERIMA`, `KAGET_MASA_JAM`, `KAGET_MAKS_AKTIF`, `KAGET_BIAYA_PERSEN`,
  `KAGET_UMUR_AKUN_JAM`.

## Menjalankan

```bash
npm install
cp .env.example .env.local   # isi MONGODB_URI
npm run dev                  # http://localhost:3000
```

Hanya `MONGODB_URI` yang wajib di environment (kunci enkripsi konfigurasi diturunkan darinya). Kunci lain
(WarungNokos, Pakasir, AustinPay, Telegram, kode admin, dll.) diisi lewat **Admin → Konfigurasi** dan disimpan
terenkripsi — jangan ditulis di kode/repo. Minimal supaya nokos jalan: `WARUNGNOKOS_APIKEY` (format `wn-...`).
Untuk QRIS Gateway & penarikan otomatis: `AUSTINPAY_APIKEY`, `AUSTINPAY_APISECRET`, `AUSTINPAY_WEBHOOK_SECRET`
(IP server harus di-whitelist di AustinPay).

## Deploy
- **Render** — New → Blueprint, pilih repo ini (`render.yaml`). Penjadwal internal aktif (`INTERNAL_CRON=1`).
- **Vercel** — import repo, isi `MONGODB_URI`; cron di `vercel.json`. Untuk menjalankan penyapu tiap menit
  (deposit tertunda, Kaget, penarikan macet) arahkan cron eksternal ke `/api/cron/tick?secret=…`.
- **Netlify** — `netlify.toml` sudah ada; cron lewat cron eksternal.
- **Cloudflare Workers** — lihat `deploy/cloudflare/README.md` (eksperimental).
- Atlas: izinkan IP `0.0.0.0/0` (hosting serverless tidak punya IP tetap).

## Struktur singkat
- `app/` halaman & API route · `components/` UI · `lib/` logika (provider, deposit, order nokos, keamanan)
- `lib/otpServers.js` server nokos · `lib/depositRute.js` rute deposit · `lib/configRegistry.js` konfigurasi terenkripsi
- `lib/kaget.js` Saldo Kaget · `lib/cashback.js` + `lib/cashbackHitung.js` cashback bertingkat
- `lib/gateway*.js`, `lib/callbackAman.js` QRIS gateway, penarikan otomatis, callback merchant (SSRF-safe)
- `docs/` dokumentasi AustinPay & WarungNokos (resmi dan turunan kode), teks promosi

## Catatan jujur
Integrasi provider (WarungNokos, AustinPay, Pakasir, dll.) diuji dengan **server palsu** yang meniru dokumentasinya;
belum diuji ke layanan asli dengan uang sungguhan. Uji dulu dengan nominal kecil setelah kunci diisi.
