# WarungNokos — Dokumentasi Resmi SERVER 1 (Server Plus / "Developer API Docs")

> **Asal dokumen.** Isi di bawah adalah dokumentasi resmi WarungNokos **"Developer API Docs"** yang kamu tempelkan di percakapan, saya rapikan
> ke Markdown **tanpa mengubah isi** (nama endpoint, parameter, dan contoh respons sama dengan aslinya). API key di contoh diganti `YOUR_API_KEY`.
> Bagian **"Catatan Artapedia"** di akhir adalah tambahan dari saya (bukan dari WarungNokos).
>
> Dokumen ini mencakup: **profil & saldo**, **beli OTP (H2H) lewat `/api/otp/*`**, dan **keuangan / deposit (`/api/deposit/*`)**.
> Dokumen Server 2 ada di berkas terpisah: `WARUNGNOKOS-RESMI-SERVER2.md`.

**Base URL:** `https://warungnokos.web.id`

**Autentikasi:** semua endpoint memakai header `x-api-key: YOUR_API_KEY`.

---

## Daftar isi

**Mulai di sini** — Pengantar API · Cek Profil & Saldo
**Layanan OTP (H2H)** — Daftar Layanan · Daftar Negara · Daftar Operator · Order OTP Baru · Cek Status OTP · Batal / Resend OTP
**Keuangan** — Buat Tagihan Deposit · Cek Status Deposit · Batalkan Deposit

---

## 1. Users Profile & Balance

Mengambil informasi detail tentang profil akun WarungNokos Anda dan saldo terkini yang dapat digunakan untuk transaksi H2H.

`GET /api/user/profile`

```js
const options = {
    method: 'GET',
    url: 'https://warungnokos.web.id/api/user/profile',
    headers: {
        'x-api-key': 'YOUR_API_KEY_HERE',
        'Accept': 'application/json'
    }
};
const response = await axios(options);
```

Success Response
```json
{
    "success": true,
    "data": {
        "username": "developer_pro",
        "email": "dev@mail.com",
        "balance": 150000,
        "referralCode": "A1B2C3"
    }
}
```

---

## 2. Services Available (Daftar Layanan)

Daftar lengkap layanan aplikasi (WhatsApp, Telegram, dll) yang tersedia di server kami untuk keperluan OTP.

`GET /api/otp/services`

```js
const options = {
    method: 'GET',
    url: 'https://warungnokos.web.id/api/otp/services',
    headers: {
        'x-api-key': 'YOUR_API_KEY_HERE',
        'Accept': 'application/json'
    }
};
const response = await axios(options);
```

Success Response (V2 Format)
```json
{
    "success": true,
    "data": [
        {
            "service_code": 14,
            "service_name": "WhatsApp",
            "service_img": "https://link/wa.png"
        },
        {
            "service_code": 86,
            "service_name": "Telegram",
            "service_img": "https://link/tg.png"
        }
    ]
}
```

---

## 3. Countries Available (Daftar Negara + Pricelist)

Mengambil daftar negara beserta pricelist (harga & stok) yang tersedia secara spesifik berdasarkan ID Layanan yang dipilih.

`GET /api/otp/countries/:serviceId`

| Parameter | Tipe | Lokasi | Diperlukan | Deskripsi |
|---|---|---|---|---|
| `serviceId` | string | URL Path | Ya | ID layanan (contoh: `14` untuk WhatsApp) |

```js
const options = {
    method: 'GET',
    // Ganti :serviceId dengan ID layanan (contoh 14)
    url: 'https://warungnokos.web.id/api/otp/countries/:serviceId',
    headers: {
        'x-api-key': 'YOUR_API_KEY_HERE',
        'Accept': 'application/json'
    }
};
const response = await axios(options);
```

Success Response (V2 Format)
```json
{
    "success": true,
    "data": [
        {
            "number_id": 340437,
            "name": "Indonesia",
            "prefix": "+62",
            "stock_total": 103,
            "pricelist": [
                {
                    "provider_id": "3837",
                    "server_id": 3,
                    "stock": 103,
                    "rate": 81.6,
                    "price": 1100
                }
            ]
        }
    ]
}
```

---

## 4. List Operator

Daftar lengkap operator seluler berdasarkan negara dan `provider_id` yang dipilih.

`GET /api/otp/operators/:country/:providerId`

| Parameter | Tipe | Lokasi | Diperlukan | Deskripsi |
|---|---|---|---|---|
| `country` | string | URL Path | Ya | Nama negara (contoh: `indonesia`) |
| `providerId` | string | URL Path | Ya | Provider ID dari list pricelist (contoh: `3837`) |

```js
const options = {
    method: 'GET',
    url: 'https://warungnokos.web.id/api/otp/operators/:country/:providerId',
    headers: {
        'x-api-key': 'YOUR_API_KEY_HERE',
        'Accept': 'application/json'
    }
};
const response = await axios(options);
```

Success Response (V2 Format)
```json
{
    "success": true,
    "data": [
        { "id": "any", "name": "any", "image": "https://link/any.ico" },
        { "id": "telkomsel", "name": "telkomsel", "image": "https://link/telkomsel.jpg" }
    ]
}
```

---

## 5. Create Order OTP (Order OTP Baru)

Endpoint untuk membeli nomor virtual. Saldo akan otomatis terpotong. *(Sistem V2: Atomic & White-Label)*

`POST /api/otp/order`

| Parameter | Tipe | Lokasi | Diperlukan | Deskripsi |
|---|---|---|---|---|
| `number_id` | string | body | Ya | `number_id` dari list negara |
| `provider_id` | string | body | Ya | `provider_id` dari pricelist server |
| `operator_id` | string | body | Ya | `id` dari list operator (contoh: `"any"`) |
| `price_jual` | number | body | Ya | Harga modal + markup Anda |
| `service_name` | string | body | Opsional | Nama layanan untuk label (contoh: `"WhatsApp"`) |

```js
const options = {
    method: 'POST',
    url: 'https://warungnokos.web.id/api/otp/order',
    headers: {
        'x-api-key': 'YOUR_API_KEY_HERE',
        'Content-Type': 'application/json'
    },
    data: {
        "number_id": "340437",
        "provider_id": "3837",
        "operator_id": "any",
        "price_jual": 3500,
        "service_name": "WhatsApp"
    }
};
const response = await axios(options);
```

Success Response (White-Label)
```json
{
    "success": true,
    "data": {
        "trxId": "WN0000000125",
        "serviceName": "WhatsApp",
        "phoneNumber": "+62 812 3456 7890",
        "amount": 3500,
        "status": "waiting",
        "createdAt": "2026-04-02T12:00:00.000Z"
    }
}
```

---

## 6. Check Order Status (Cek Status OTP)

Periksa status pesanan nomor Anda (apakah SMS sudah masuk). **Lakukan polling setiap 4–5 detik** pada endpoint ini. *(Sistem Race-Condition Safe)*

`GET /api/otp/status/:orderId`

| Parameter | Tipe | Lokasi | Diperlukan | Deskripsi |
|---|---|---|---|---|
| `orderId` | string | URL Path | Ya | ID Trx lokal (contoh: `"WN0000000125"`) |

```js
const options = {
    method: 'GET',
    // Masukkan trxId WN... di URL
    url: 'https://warungnokos.web.id/api/otp/status/WN0000000125',
    headers: {
        'x-api-key': 'YOUR_API_KEY_HERE',
        'Accept': 'application/json'
    }
};
const response = await axios(options);
```

Success Response (saat SMS masuk)
```json
{
    "success": true,
    "status": "completed",   // waiting, completed, canceled
    "otp_code": "949708"
}
```

---

## 7. Set Order Status (Batal / Resend OTP)

Ubah status pesanan secara manual (contoh: batalkan OTP jika kelamaan). Saldo akan dikembalikan jika dibatalkan.

`POST /api/otp/set_status`

| Parameter | Tipe | Lokasi | Diperlukan | Deskripsi |
|---|---|---|---|---|
| `trxId` | string | body | Ya | ID Trx lokal (contoh: `"WN0000000125"`) |
| `action_status` | string | body | Ya | Aksi: `cancel`, `done`, `resend` |

```js
const options = {
    method: 'POST',
    url: 'https://warungnokos.web.id/api/otp/set_status',
    headers: {
        'x-api-key': 'YOUR_API_KEY_HERE',
        'Content-Type': 'application/json'
    },
    data: {
        "trxId": "WN0000000125",
        "action_status": "cancel"
    }
};
const response = await axios(options);
```

Success Response
```json
{
    "success": true,
    "message": "Status berhasil diubah menjadi cancel"
}
```

---

# KEUANGAN (Deposit)

## 8. Create Deposit (V2)

Buat kode tagihan pembayaran untuk top-up saldo user. Mendukung metode **QRIS** dan **Crypto USDT**. **Maksimal 3 transaksi pending.**

`POST /api/deposit/create`

| Parameter | Tipe | Lokasi | Diperlukan | Deskripsi |
|---|---|---|---|---|
| `amount` | number | body | Ya | Jumlah deposit (**Min: 2000**) |
| `method` | string | body | Opsional | Metode: `qris`, `usdt-trc-20`, dll. (Default: `qris`) |

```js
const options = {
    method: 'POST',
    url: 'https://warungnokos.web.id/api/deposit/create',
    headers: {
        'x-api-key': 'YOUR_API_KEY_HERE',
        'Content-Type': 'application/json'
    },
    data: {
        "amount": 50000,
        "method": "qris"
    }
};
const response = await axios(options);
```

Success Response (White-Label) — *perhatikan: field berada di level atas, bukan di dalam `data`*
```json
{
    "success": true,
    "trxId": "WN0000000050",
    "qr_string": "00020101021126600015...",
    "qr_image": "https://qris.url/img.png",
    "total": 50200,
    "expired_at": 1775022865340
}
```

## 9. Deposit Status (V2)

Periksa status pembayaran deposit. Jika berhasil, objek `detail` akan terisi nama brand pembayaran (misal DANA, OVO, TRON).

`GET /api/deposit/status/:trxId`

| Parameter | Tipe | Lokasi | Diperlukan | Deskripsi |
|---|---|---|---|---|
| `trxId` | string | URL Path | Ya | ID Deposit (contoh: `"WN0000000050"`) |

```js
const options = {
    method: 'GET',
    url: 'https://warungnokos.web.id/api/deposit/status/WN0000000050',
    headers: {
        'x-api-key': 'YOUR_API_KEY_HERE',
        'Accept': 'application/json'
    }
};
const response = await axios(options);
```

Success Response (lengkap dengan metadata)
```json
{
    "success": true,
    "status": "success",   // pending, success, cancel
    "amount": 50000,
    "detail": {
        "created_at": "2026-04-02 12:34:25",
        "total": 50200,
        "fee": 200,
        "diterima": 50000,
        "brand_name": "DANA",
        "buyer_reff": "1js8mUeShBIw"
    }
}
```

## 10. Deposit Cancel

Batalkan status tagihan pembayaran deposit yang masih berstatus tertunda (pending).

`POST /api/deposit/cancel`

| Parameter | Tipe | Lokasi | Diperlukan | Deskripsi |
|---|---|---|---|---|
| `trxId` | string | body | Ya | ID Deposit (contoh: `"WN0000000050"`) |

```js
const options = {
    method: 'POST',
    url: 'https://warungnokos.web.id/api/deposit/cancel',
    headers: {
        'x-api-key': 'YOUR_API_KEY_HERE',
        'Content-Type': 'application/json'
    },
    data: { "trxId": "WN0000000050" }
};
const response = await axios(options);
```

Success Response
```json
{
    "success": true,
    "message": "Deposit dibatalkan",
    "detail": {
        "created_at": "2026-04-02 12:34:25",
        "total": 50200,
        "fee": 200,
        "diterima": 50000,
        "brand_name": "QRIS",
        "buyer_reff": "-"
    }
}
```

---

## Ringkasan endpoint Server 1

| Fungsi | Method & path |
|---|---|
| Profil & saldo | `GET /api/user/profile` |
| Daftar layanan | `GET /api/otp/services` |
| Negara + pricelist per layanan | `GET /api/otp/countries/:serviceId` |
| Operator | `GET /api/otp/operators/:country/:providerId` |
| Order | `POST /api/otp/order` |
| Status / OTP | `GET /api/otp/status/:orderId` |
| Batal / selesai / kirim ulang | `POST /api/otp/set_status` |
| Buat deposit | `POST /api/deposit/create` |
| Status deposit | `GET /api/deposit/status/:trxId` |
| Batal deposit | `POST /api/deposit/cancel` |

**Alur Server 1:** `services` → `countries/:serviceId` (dapat `number_id`, `provider_id`, `price`) → `operators` (opsional, `any`) → `order` →
polling `status` tiap 4–5 detik → bila kelamaan `set_status` `cancel`.

---

## Catatan Artapedia *(bukan bagian dari dokumen WarungNokos)*

1. **Server 1 di Artapedia sekarang TIDAK lagi memesan lewat `/api/otp/*`.** Sejak migrasi, pembelian baru untuk Server 1 dan Server 2 sama-sama
   memakai API baru `/api/warkosv3/*` (lihat berkas Server 2); Server 1 menampilkan produk yang bernama "Server 1" di API itu. Jalur `/api/otp/*`
   hanya dipakai sebagai **cadangan** untuk membaca status / membatalkan pesanan yang dibuat **sebelum** migrasi (saat `warkosv3` membalas 404).
2. **Deposit (`/api/deposit/*`) tetap dipakai persis seperti dokumen ini** (`method: "qris"`; Crypto USDT tidak ditawarkan ke pengguna).
3. Kode Artapedia untuk bagian ini: `lib/warungnokos.js` (`createWarungNokosDeposit`, `getWarungNokosDepositStatus`, `cancelWarungNokosDeposit`, dan cabang `otp`).
4. Pada `POST /api/otp/order`, dokumen menyebut `price_jual` sebagai "harga modal + markup Anda", tetapi respons mengembalikan `amount` yang sama dengan
   nilai yang dikirim. Karena tidak jelas nilai mana yang dipotong dari saldo WarungNokos, kode Artapedia **selalu mengirim harga modal dari pricelist**;
   markup untuk pembeli dihitung di sisi Artapedia.
5. Status order: Artapedia membaca `waiting` / `completed` / `canceled` (juga mengenali `expired`, `failed`); status deposit: `pending` / `success` / `cancel`
   (juga mengenali `expired`, `failed`).
6. Dokumentasi lengkap alur Artapedia (deposit sampai beli, refund, jaminan) ada di `DOKUMENTASI-WARUNGNOKOS.md`.
