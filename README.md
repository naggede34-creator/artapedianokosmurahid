# Artapedia — toko nokos & QRIS gateway

Website khusus **beli nomor OTP (nokos)** dan **QRIS gateway** untuk reseller/developer.
Dibangun dengan Next.js 15 (App Router) + MongoDB, tema komik 3D, bisa dipasang sebagai PWA.

## Fitur

**Pengguna**
- **Beli nokos** — server WarungNokos (Server 1 & Server 2), pilih layanan → negara → beli, OTP masuk
  otomatis, ganti nomor, batalkan & refund otomatis kalau OTP tidak datang.
- **Deposit** — QRIS otomatis (WarungNokos, Pakasir, RumahOTP, Atlantic, QRIS Fast/AustinPay) dan QRIS
  manual + OCR bukti. Rute deposit dipilih acak/berbobot oleh admin, ada cashback deposit.
- **Undang teman** (bonus deposit pertama + level), **Leaderboard**, **Giveaway**, voucher, transfer
  saldo, tarik saldo, riwayat & mutasi.
- **API Key + dokumentasi** untuk nokos dan QRIS gateway (`/api-docs`, `/gateway`).
- **Notifikasi** ke channel Telegram (order nokos, deposit, dll.), bot utama, dan **bot reseller**.

**Admin** (`/admin`)
- Pengguna, saldo, koreksi, keamanan & IP/perangkat ganda, rute deposit, provider, harga & markup,
  server nokos, voucher, broadcast, banner, tiket bantuan, laporan stok, backup, konfigurasi terenkripsi,
  izin per peran admin.

## Yang sengaja tidak ada lagi
Game, poin, VIP/loyalty, PPOB, produk digital, serta server nokos selain WarungNokos (RumahOTP hanya
dipakai sebagai metode deposit). Backup versi lama ada di branch `cadangan-sebelum-rombak`.

## Menjalankan

```bash
npm install
cp .env.example .env.local   # isi MONGODB_URI
npm run dev                  # http://localhost:3000
```

Hanya `MONGODB_URI` yang wajib di environment (kunci enkripsi konfigurasi diturunkan darinya).
Kunci lain (WarungNokos, Pakasir, Telegram, kode admin, dll.) diisi lewat **Admin → Konfigurasi**
dan disimpan terenkripsi — jangan ditulis di kode/repo. Kunci wajib supaya nokos jalan:
`WARUNGNOKOS_APIKEY` (format `wn-...`).

## Deploy
- **Render** — New → Blueprint, pilih repo ini (`render.yaml`). Penjadwal internal aktif (`INTERNAL_CRON=1`).
- **Vercel** — import repo, isi `MONGODB_URI`; cron di `vercel.json`.
- **Cloudflare Workers** — lihat `deploy/cloudflare/README.md` (eksperimental; ukuran bundle dekat batas paket gratis).
- Atlas: izinkan IP `0.0.0.0/0` (hosting serverless tidak punya IP tetap).

## Struktur singkat
- `app/` halaman & API route · `components/` UI · `lib/` logika (provider, deposit, order nokos, keamanan)
- `lib/otpServers.js` daftar server nokos · `lib/depositRute.js` rute deposit · `lib/configRegistry.js` konfigurasi terenkripsi
- `docs/` teks promosi & dokumentasi AustinPay
