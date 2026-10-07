# WarungNokos — Dokumentasi Resmi SERVER 2

> **Asal dokumen.** Isi di bawah adalah dua dokumentasi resmi WarungNokos untuk Server 2 yang kamu tempelkan di percakapan, saya rapikan ke Markdown
> **tanpa mengubah isi**. API key di contoh diganti `YOUR_API_KEY`. Bagian **"Catatan Artapedia"** di akhir adalah tambahan dari saya.
>
> Server 2 punya **dua versi dokumen**:
>
> | | Dokumen | Base path | Status |
> |---|---|---|---|
> | **A** | **"Dokumentasi API Server 2"** (baru) | `/api/warkosv3/*` | **versi terbaru** — dipakai Artapedia untuk Server 1 *dan* Server 2 |
> | **B** | **"API Docs · Server2"** (lama) | `/api/smscode/*` | versi lama — hanya dipakai sebagai cadangan untuk pesanan lama |
>
> Dokumen Server 1 ("Developer API Docs", `/api/otp/*` + deposit) ada di berkas terpisah: `WARUNGNOKOS-RESMI-SERVER1.md`.
> Di dokumen yang kamu tempelkan, tab contoh respons error selain yang tertulis di bawah tidak ikut tersalin; hanya yang ada yang dimuat di sini.

**Base URL:** `https://warungnokos.web.id`

---

# BAGIAN A — Dokumentasi API Server 2 (baru, `/api/warkosv3`)

Beli nomor virtual dan terima kode OTP secara otomatis lewat satu API. Seluruh harga yang ditampilkan sudah **final** dan langsung dipotong dari saldo akun Anda.

### Alur penggunaan
`Countries` (pilih negara) → `Services` (pilih layanan) → `Products` (pilih server) → `Order` (beli nomor) → `Status` (ambil kode OTP)

### Autentikasi
Setiap request wajib menyertakan API Key pada header `x-api-key`. API Key dibuat dari akun Anda di Dashboard.
```
x-api-key: YOUR_API_KEY
```
> Simpan API Key hanya di server Anda. Jika bocor, buat ulang dari Dashboard dan key lama otomatis tidak berlaku.

### Format respons
Semua respons berupa JSON dengan field `success`. Saat gagal, penjelasan ada pada field `message`.

| Kode HTTP | Arti |
|---|---|
| 200 | Request berhasil. |
| 400 | Parameter kurang, saldo tidak cukup, atau ditolak provider. |
| 401 | API Key tidak dikirim atau tidak valid. |
| 403 | API Key dinonaktifkan atau IP diblokir. |
| 404 | Data yang diminta tidak ditemukan. |
| 500 | Gangguan di sisi server atau provider. |

Contoh respons autentikasi (401 API Key tidak dikirim / 401 API Key tidak valid / 403 API Key nonaktif):
```json
{
  "success": false,
  "message": "Akses ditolak. Tidak ada token atau API Key."
}
```

## A1. Countries — daftar negara
Mengambil daftar negara yang tersedia. Gunakan nilai `id` negara pada endpoint Services dan Products.

`GET /api/warkosv3/countries` — header `x-api-key` (wajib). Tanpa parameter.

```bash
curl -X GET "https://warungnokos.web.id/api/warkosv3/countries" \
  -H "x-api-key: YOUR_API_KEY"
```
Respons 200:
```json
{
  "success": true,
  "data": [
    { "id": 7, "code": "ID", "name": "Indonesia", "dial_code": "+62" },
    { "id": 6, "code": "MY", "name": "Malaysia",  "dial_code": "+60" }
  ]
}
```

## A2. Services — daftar layanan per negara
Mengambil daftar layanan atau aplikasi yang tersedia pada negara tertentu.

`GET /api/warkosv3/services`

| Nama | Lokasi | Tipe | Wajib | Keterangan |
|---|---|---|---|---|
| `country_id` | Query | integer | ya | ID negara dari endpoint Countries |

```bash
curl -X GET "https://warungnokos.web.id/api/warkosv3/services?country_id=7" \
  -H "x-api-key: YOUR_API_KEY"
```
Respons 200:
```json
{
  "success": true,
  "data": [
    { "id": 1, "name": "WhatsApp" },
    { "id": 2, "name": "Telegram" }
  ]
}
```
Respons lain yang disebut dokumen: 400 Parameter kurang, 500 Gangguan server.

## A3. Products — daftar server & harga
Mengambil daftar server beserta harga untuk kombinasi negara dan layanan.
> Nilai `price` adalah **harga final dalam rupiah**, yaitu nominal yang dipotong dari saldo saat order.

`GET /api/warkosv3/products`

| Nama | Lokasi | Tipe | Wajib | Keterangan |
|---|---|---|---|---|
| `country_id` | Query | integer | ya | ID negara dari endpoint Countries |
| `service_id` | Query | integer | ya | ID layanan dari endpoint Services |

```bash
curl -X GET "https://warungnokos.web.id/api/warkosv3/products?country_id=7&service_id=1" \
  -H "x-api-key: YOUR_API_KEY"
```
Respons 200:
```json
{
  "success": true,
  "data": [
    { "id": 765693933, "name": "Server 1", "price": 4212, "price_format": "Rp4.212" },
    { "id": 760385044, "name": "Server 2", "price": 4220, "price_format": "Rp4.220" }
  ]
}
```
Respons lain yang disebut dokumen: 400 Parameter kurang, 400 Tidak tersedia, 500 Gangguan server.

## A4. Order — beli satu nomor
Membeli satu nomor virtual. Saldo dipotong saat order berhasil dan **dikembalikan otomatis** jika order dibatalkan atau kedaluwarsa.
> Request ini membeli nomor sungguhan dan memotong saldo. **Harga selalu dihitung ulang di server, jadi tidak perlu mengirim harga.**

`POST /api/warkosv3/order` — header: `x-api-key` (wajib), `Content-Type: application/json` (wajib)

| Nama | Lokasi | Tipe | Wajib | Keterangan |
|---|---|---|---|---|
| `country_id` | Body | integer | ya | ID negara dari endpoint Countries |
| `service_id` | Body | integer | ya | ID layanan dari endpoint Services |
| `product_id` | Body | integer | ya | ID server dari endpoint Products |
| `service_name` | Body | string | opsional | Nama pesanan pada riwayat, misalnya `WhatsApp (Indonesia)` |
| `app_logo` | Body | string | opsional | URL logo aplikasi untuk riwayat pesanan |

```bash
curl -X POST "https://warungnokos.web.id/api/warkosv3/order" \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"country_id":7,"service_id":1,"product_id":765693933,"service_name":"WhatsApp (Indonesia)"}'
```
Respons 200:
```json
{
  "success": true,
  "data": {
    "trxId": "WN0000000123",
    "serviceName": "WhatsApp (Indonesia)",
    "phoneNumber": "6283857979325",
    "amount": 4212,
    "status": "waiting",
    "createdAt": "2026-10-05T09:12:44.000Z",
    "expires_at": "2026-10-05 09:28:44"
  }
}
```
Respons lain yang disebut dokumen: 400 Parameter kurang, 400 Saldo tidak cukup, 400 Ditolak provider, 404 Produk tidak ada.

## A5. Status — cek status & ambil OTP
Memeriksa status order dan mengambil kode OTP. **Panggil endpoint ini setiap 5 detik** sampai status menjadi `completed` atau `canceled`.

`GET /api/warkosv3/status/{trxId}`

| Nama | Lokasi | Tipe | Wajib | Keterangan |
|---|---|---|---|---|
| `trxId` | Path | string | ya | ID transaksi dari respons Order |

| Status | Arti |
|---|---|
| `waiting` | Menunggu SMS masuk. Lanjutkan polling. |
| `completed` | OTP diterima dan tersedia pada field `otp_code`. |
| `canceled` | Order dibatalkan atau kedaluwarsa. Saldo sudah dikembalikan. |

```bash
curl -X GET "https://warungnokos.web.id/api/warkosv3/status/WN0000000123" \
  -H "x-api-key: YOUR_API_KEY"
```
Respons 200 (menunggu SMS):
```json
{
  "success": true,
  "status": "waiting",
  "otp_code": null
}
```
Respons lain yang disebut dokumen: 200 OTP diterima, 200 Dibatalkan, 404 Tidak ditemukan.

## A6. Cancel — batalkan order
Membatalkan order yang masih menunggu SMS. Saldo dikembalikan penuh.
> **Order hanya bisa dibatalkan setelah 3 menit sejak dibuat.**

`POST /api/warkosv3/cancel` — header: `x-api-key` (wajib), `Content-Type: application/json` (wajib)

| Nama | Lokasi | Tipe | Wajib | Keterangan |
|---|---|---|---|---|
| `trxId` | Body | string | ya | ID transaksi dari respons Order |

```bash
curl -X POST "https://warungnokos.web.id/api/warkosv3/cancel" \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"trxId":"WN0000000123"}'
```
Respons 200:
```json
{
  "success": true,
  "message": "Pesanan berhasil dibatalkan dan saldo dikembalikan."
}
```
Respons lain yang disebut dokumen: 400 Belum 3 menit, 400 Sudah selesai, 404 Tidak ditemukan.

### Ringkasan endpoint — bagian A
| Fungsi | Method & path |
|---|---|
| Negara | `GET /api/warkosv3/countries` |
| Layanan per negara | `GET /api/warkosv3/services?country_id=` |
| Server & harga | `GET /api/warkosv3/products?country_id=&service_id=` |
| Order | `POST /api/warkosv3/order` |
| Status / OTP | `GET /api/warkosv3/status/{trxId}` |
| Batal | `POST /api/warkosv3/cancel` |

---

# BAGIAN B — API Docs · Server2 (lama, `/api/smscode`)

Dokumentasi ini khusus untuk integrasi API OTP menggunakan sistem Server2. Semua endpoint telah dienkapsulasi dan diotomatisasi. Anda wajib menggunakan
API Key yang ada di menu **Profil** Anda untuk mencoba Cek Harga, Order, maupun Cek Status.

**Base URL API Endpoint:** `https://warungnokos.web.id/api/smscode`

**Autentikasi (wajib):** header `x-api-key` (string, contoh `wn-123xyz...`).

### B1. Daftar Layanan
Mengambil daftar seluruh layanan aplikasi (WhatsApp, Telegram, Instagram) yang didukung dan sedang aktif.

`GET /api/smscode/services`
```js
const axios = require('axios');
const options = {
  method: 'GET',
  url: 'https://warungnokos.web.id/api/smscode/services',
  headers: { 'x-api-key': 'YOUR_API_KEY_HERE' }
};
axios(options).then(res => console.log(res.data));
```
200 OK:
```json
{ "success": true, "data": [ { "id": 3, "code": "wa", "name": "WhatsApp", "active": true } ] }
```

### B2. Daftar Negara
Mengambil daftar lengkap negara beserta ID dan emoji benderanya.

`GET /api/smscode/countries`
200 OK:
```json
{ "success": true, "data": [ { "id": 6, "name": "Indonesia", "emoji": "🇮🇩", "active": true } ] }
```

### B3. Server & Harga
Mendapatkan daftar server (beserta ketersediaan stok & harga) berdasarkan ID layanan dan ID negara.

`GET /api/smscode/products`

| Parameter query | Tipe | Wajib | Deskripsi |
|---|---|---|---|
| `platform_id` | number | ya | ID layanan (cth: 3 untuk WhatsApp) |
| `country_id` | number | opsional | ID negara (cth: 6 untuk Indonesia) |

```js
url: 'https://warungnokos.web.id/api/smscode/products?platform_id=3&country_id=6',
headers: { 'x-api-key': 'YOUR_API_KEY_HERE' }
```
200 OK:
```json
{
  "success": true,
  "data": [
    { "id": 142, "name": "WhatsApp Indonesia (S1)", "country_id": 6, "platform_id": 3,
      "available": 42, "price": 1500, "active": true }
  ]
}
```

### B4. Order OTP Baru
Mengeksekusi pembelian nomor virtual. Saldo otomatis terpotong dari akun Anda.

`POST /api/smscode/order`

| Body JSON | Tipe | Wajib | Deskripsi |
|---|---|---|---|
| `product_id` | number | ya | ID server/product (contoh: 142) |
| `app_id` | number | ya | ID layanan/aplikasi (contoh: 3) |
| `country_id` | number | ya | ID negara (contoh: 6) |
| `service_name` | string | opsional | Label manual (contoh: `"WhatsApp Indo"`) |

```js
data: { product_id: 142, app_id: 3, country_id: 6, service_name: "WhatsApp" }
```
200 OK:
```json
{
  "success": true,
  "data": {
    "trxId": "WN0000000001",
    "serviceName": "WhatsApp (Indonesia)",
    "phoneNumber": "628123456789",
    "amount": 1500,
    "status": "waiting",
    "createdAt": "2026-05-12T10:00:00.000Z"
  }
}
```

### B5. Cek Status OTP
Mengecek status dan kode OTP. Gunakan `trxId` dari balasan Order OTP.

`GET /api/smscode/status/:trxId` — `trxId` (path, string, wajib; cth `WN0000000001`)

200 OK (saat SMS masuk):
```json
{ "success": true, "status": "completed", "otp_code": "123456" }
```

### B6. Batalkan Order
Membatalkan pesanan yang sedang aktif. Jika berhasil (atau jika dari pusat memang sudah batal/expired), sistem otomatis melakukan **refund saldo** Anda.

`POST /api/smscode/cancel` — body `{ "trxId": "WN0000000001" }`

200 OK:
```json
{ "success": true, "message": "Berhasil dibatalkan" }
```

### Ringkasan endpoint — bagian B
| Fungsi | Method & path |
|---|---|
| Layanan | `GET /api/smscode/services` |
| Negara | `GET /api/smscode/countries` |
| Server & harga | `GET /api/smscode/products?platform_id=&country_id=` |
| Order | `POST /api/smscode/order` |
| Status / OTP | `GET /api/smscode/status/:trxId` |
| Batal | `POST /api/smscode/cancel` |

---

## Perbedaan A (baru) dan B (lama), singkatnya

| | A — `/api/warkosv3` | B — `/api/smscode` |
|---|---|---|
| Layanan | per negara (`/services?country_id=`) | satu daftar global (`/services`) |
| Pilih server | `/products?country_id=&service_id=` → `id`, `name` ("Server 1/2"), `price` | `/products?platform_id=&country_id=` → `id`, `name`, `available` (stok), `price` |
| Parameter order | `country_id`, `service_id`, `product_id` | `product_id`, `app_id`, `country_id` |
| Harga | final, dihitung ulang di server | harga di respons `products` / `amount` |
| Stok | tidak ada | ada (`available`) |
| Kedaluwarsa di respons order | `expires_at` | — |
| Interval polling disarankan | 5 detik | — |
| Batas batal | 3 menit setelah order | — (tidak tertulis) |

---

## Catatan Artapedia *(bukan bagian dari dokumen WarungNokos)*

1. **Bagian A (`/api/warkosv3`) dipakai untuk Server 1 *dan* Server 2** di Artapedia. Bedanya hanya produk yang ditampilkan: `WARUNGNOKOS_PISAH_SERVER=1` (bawaan)
   membuat Server 1 menampilkan produk bernama "Server 1" dan Server 2 menampilkan "Server 2" (angka ≥ 2). Bila diset `0`, keduanya menampilkan semua produk.
2. **Bagian B (`/api/smscode`) tidak dipakai untuk pembelian baru.** Hanya sebagai cadangan: bila `status`/`cancel` ke `warkosv3` membalas 404 untuk pesanan
   Server 2 yang dibuat sebelum migrasi, kode mencoba `/api/smscode/status/{trxId}` atau `/api/smscode/cancel`.
3. **Layanan digabung lintas negara** berdasarkan nama (mis. `whatsapp`), karena `/services` per negara sedangkan web memilih layanan dulu baru negara.
   Id numerik tiap negara dicari ulang saat order.
4. **Interval polling & batas batal** mengikuti dokumen: pembatalan dari Artapedia baru diizinkan **3 menit** setelah pembelian, dan status dicek
   ke WarungNokos sebelum refund agar tidak mungkin dapat OTP *dan* refund sekaligus.
5. Dokumen menyebut `expires_at` (±16 menit pada contoh), tetapi kode Artapedia saat ini memakai **masa aktif standar 20 menit** dari sisi sendiri
   (`expiredAt`); status `canceled` dari WarungNokos tetap menjadi acuan refund.
6. Pada kode, API key khusus Server 2 bisa diisi terpisah di `WARUNGNOKOS_V3_APIKEY` bila WarungNokos menerbitkan key berbeda; kosong = pakai `WARUNGNOKOS_APIKEY`.
7. Kode Artapedia: `lib/warungnokos.js`. Dokumentasi alur lengkap (deposit sampai beli, refund, jaminan): `DOKUMENTASI-WARUNGNOKOS.md`.
