# Dokumentasi Lengkap AustinPay — integrasi Artapedia

> **Penting dibaca dulu.** Dokumen ini disusun dari **kode integrasi Artapedia** (`lib/austinpay.js`, `lib/wdInstan.js`,
> `lib/gatewayWd.js`, `lib/gateway.js`, `app/api/deposit/austinpay-webhook/route.js`) dan dari server uji AustinPay palsu
> yang dipakai saat pengujian. Ini **bukan salinan dokumentasi resmi AustinPay**. Endpoint, field, dan perilaku yang tertulis di
> sini adalah yang **dipakai dan sudah dicoba terhadap server palsu**; belum pernah diuji terhadap AustinPay asli. Field yang
> tidak dipakai kode kami tidak tercakup. Cocokkan dengan dokumentasi resmi di dashboard AustinPay sebelum mengandalkan angka
> atau perilaku tertentu (batas minimal/maksimal, format `expired_at`, dsb.).
>
> **Keamanan:** jangan menulis API key / secret di kode atau repo. Isi hanya lewat **Admin → Konfigurasi** (tersimpan terenkripsi).

---

## 1. Apa yang dipakai dari AustinPay

| # | Fungsi | Arah uang | Dipakai oleh |
|---|---|---|---|
| 1 | **Deposit QRIS FAST** | masuk | deposit saldo nokos pengguna (metode `qrisfast`) |
| 2 | **Tagihan QRIS Gateway** | masuk | tagihan merchant di `/gateway` dan `POST /api/gw/v1/invoice` |
| 3 | **Withdraw Instant (bebas nominal)** | keluar | penarikan saldo Stor Gmail (`/setor-gmail`) dan penarikan saldo QRIS Gateway |
| 4 | **Saldo & penarikan admin** | keluar | panel Admin → AustinPay (saldo, tarik saldo, riwayat) |

Semua panggilan keluar dari server Artapedia ke AustinPay lewat satu klien: `lib/austinpay.js`.

---

## 2. Konfigurasi

Isi di **Admin → Konfigurasi** (atau Environment Variables hosting; yang dari web lebih diutamakan).

| Kunci | Wajib | Keterangan |
|---|---|---|
| `AUSTINPAY_APIKEY` | ya | API key akun AustinPay. Menentukan apakah AustinPay "terkonfigurasi". |
| `AUSTINPAY_APISECRET` | disarankan | Bila diisi, **setiap** request ditandatangani HMAC (lihat §3). |
| `AUSTINPAY_WEBHOOK_SECRET` | untuk webhook | Tanpa ini webhook **ditolak 401**; pembayaran tetap terdeteksi lewat polling/penyapu. |
| `AUSTINPAY_BASE_URL` | tidak | Bawaan `https://austinstore.id`. |
| `AUSTINPAY_PROXY` | tidak | `http://user:pass@host:port` — proxy ber-IP tetap untuk whitelist. |
| `AUSTINPAY_SALDO_MIN` | tidak | Kabari admin bila saldo AustinPay di bawah angka ini (bawaan 200000; 0 = mati). |
| `GW_WD_OTOMATIS` | tidak | Saklar penarikan otomatis QRIS Gateway (1/0). Mati sendiri bila AustinPay bermasalah berulang. |
| `WD_SETOR_AKTIF` | tidak | Saklar penarikan saldo Stor Gmail (1/0). |

### IP whitelist (wajib di sisi AustinPay)
AustinPay mewajibkan IP server terdaftar untuk Public API. Hosting serverless (Vercel/Cloudflare) **tidak punya IP keluar tetap**.
Pilih salah satu:
1. Fitur **Static IPs** hosting, lalu daftarkan IP-nya di AustinPay; atau
2. VPS ber-IP tetap sebagai proxy → isi `AUSTINPAY_PROXY` → daftarkan IP VPS.

Gejala IP belum didaftarkan: semua panggilan membalas **HTTP 403** ("IP tidak terdaftar…"). Admin dikabari otomatis dan penarikan
otomatis berhenti sendiri (lihat §8).

### Webhook
Daftarkan di dashboard AustinPay → Webhook:
```
https://DOMAIN-KAMU/api/deposit/austinpay-webhook      (event: deposit.paid)
```
Satu alamat ini melayani **deposit pengguna** *dan* **tagihan QRIS Gateway**.

---

## 3. Autentikasi & tanda tangan request

Setiap request membawa:

| Header | Isi |
|---|---|
| `X-API-Key` | API key (dikirim lewat header, **bukan** `?apikey=` agar tidak tercatat di log URL) |
| `Accept` | `application/json` |
| `Content-Type` | `application/json` (hanya bila ada body) |
| `X-Timestamp` | epoch **milidetik** saat request dibuat *(hanya bila `AUSTINPAY_APISECRET` diisi)* |
| `X-Signature` | tanda tangan HMAC-SHA256 hex *(hanya bila secret diisi)* |

**Rumus tanda tangan** (sama persis dengan `tandaTangan()` di `lib/austinpay.js`):

```
string = METHOD + "\n" + PATH + "\n" + BODY + "\n" + TIMESTAMP
X-Signature = hex( HMAC_SHA256(API_SECRET, string) )
```

- `METHOD` huruf besar: `GET` / `POST`.
- `PATH` = **pathname saja**, tanpa query string (mis. `/api/instant-withdraw/products`, bukan `...?wallet=DANA`).
- `BODY` = JSON mentah persis seperti yang dikirim; untuk GET kosong (`""`).
- `TIMESTAMP` = nilai yang sama dengan header `X-Timestamp`.

Contoh (Node.js):
```js
import crypto from "node:crypto";

async function austin(method, path, { query, body } = {}) {
  const mentah = body ? JSON.stringify(body) : "";
  const ts = Date.now().toString();
  const sig = crypto.createHmac("sha256", process.env.AUSTINPAY_APISECRET)
    .update(`${method}\n${path}\n${mentah}\n${ts}`).digest("hex");
  const url = new URL("https://austinstore.id" + path);
  if (query) for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  const r = await fetch(url, {
    method,
    headers: {
      "X-API-Key": process.env.AUSTINPAY_APIKEY,
      "X-Timestamp": ts,
      "X-Signature": sig,
      Accept: "application/json",
      ...(mentah ? { "Content-Type": "application/json" } : {})
    },
    body: mentah || undefined
  });
  return r.json();
}
```

Server uji menolak signature yang salah atau timestamp yang selisihnya > 5 menit dengan **HTTP 401**. Jaga jam server tetap akurat.

---

## 4. Format balasan & penanganan error

Semua balasan JSON berbentuk `{ "success": true|false, ... }`.

Klien Artapedia menganggap **gagal** bila `success === false` **atau** HTTP ≥ 400, lalu melempar error dengan:

| Properti | Arti |
|---|---|
| `status` | HTTP status (0 = tidak ada balasan: jaringan putus / timeout) |
| `message` | `message`/`error` dari AustinPay (dipotong 300 karakter) |
| `ambigu` | **`true` = hasil TIDAK PASTI.** Hanya untuk POST yang putus/timeout atau 5xx. Uangnya mungkin sudah bergerak. |

Contoh balasan error:
```json
{ "success": false, "message": "API Key tidak valid atau tidak ditemukan" }        // 401
{ "success": false, "message": "IP tidak terdaftar di whitelist" }                  // 403
{ "success": false, "message": "Saldo tidak mencukupi" }                            // penarikan: saldo AustinPay habis
```

**Aturan emas untuk POST yang memindahkan uang:** bila `ambigu === true`, **jangan** langsung menganggap gagal dan mengembalikan uang
pengguna, dan **jangan** mengirim ulang. Cocokkan dulu ke riwayat (`/api/instant-withdraw/history`). Ini sudah ditangani di §8.

---

## 5. Referensi endpoint

### 5.1 Akun
`GET /api/account`
```json
{ "success": true, "user": { "id": "...", "username": "austi", "email": "a@x", "role": "user",
  "status": "active", "wallet": { "balance": 5000000 } } }
```
Dipakai untuk "Cek koneksi", saldo AustinPay di panel admin, dan peringatan saldo menipis.

### 5.2 Riwayat transaksi
`GET /api/transactions?page=1&limit=20&type=...&status=...` (`limit` maks 50 di klien kami)
```json
{ "success": true, "data": [ { "id": "t1", "type": "deposit", "amount": 50000, "status": "success", "created_at": "..." } ],
  "meta": { "page": 1, "limit": 10, "total": 1, "totalPages": 1 } }
```

### 5.3 Deposit — buat QRIS
`POST /api/deposit/create`
```json
{ "amount": 20000 }
```
Balasan:
```json
{ "success": true, "deposit": {
    "id": "uuid-APG-XXXX",
    "transaction_id": "APG-XXXX",          // ← dipakai untuk cek / batal / cocokkan webhook
    "amount": 20123,                       // ← yang HARUS dibayar pembeli (nominal + fee + kode unik)
    "unique_code": 123,
    "fee": 0,
    "qr_string": "00020101021226...",
    "qr_image": "data:image/png;base64,...",   // boleh kosong
    "expired_at": "2026-09-24T10:30:00.000Z",
    "status": "pending" } }
```
**Pahami angkanya:** `amount` yang **dikirim** = nominal yang akan **dikreditkan**. `deposit.amount` yang **diterima** = total yang
harus dibayar pembeli. Selisihnya = biaya admin + kode unik. Pembayaran dengan nominal yang tidak pas tidak terdeteksi.

### 5.4 Deposit — cek status
`GET /api/deposit/check/{transaction_id}`
```json
{ "success": true, "status": "paid", "message": "ok" }
```
`404` → `"Transaksi tidak ditemukan"`.

### 5.5 Deposit — batal
`POST /api/deposit/cancel/{transaction_id}` (tanpa body)
```json
{ "success": true, "status": "cancel" }
```
Hanya bisa selagi `pending` (selain itu `400 "Deposit tidak bisa dibatalkan"`).

### 5.6 Withdraw Instant — daftar wallet
`GET /api/instant-withdraw/wallets` (di-cache 5 menit oleh klien)
```json
{ "success": true,
  "wallets": ["DANA", "GoPay", "ShopeePay", "Mandiri"],
  "wallet_types": { "DANA": "phone", "GoPay": "phone", "ShopeePay": "phone", "Mandiri": "va" },
  "wallet_has_fixed": {},
  "wallet_has_open_denom": { "DANA": true, "GoPay": true, "ShopeePay": true, "Mandiri": true } }
```
Artapedia hanya menawarkan wallet bertipe **`phone`** yang punya produk **bebas nominal** (open denom). Bila API gagal dibaca,
daftar cadangan dipakai: DANA, GoPay, ShopeePay, LinkAja, iSaku, Doku, Kaspro, AstraPay.

### 5.7 Withdraw Instant — produk satu wallet
`GET /api/instant-withdraw/products?wallet=DANA` (di-cache 10 menit)
```json
{ "success": true, "products": [
  { "code": "D10",   "name": "DANA 10.000",         "open_denom": false, "nominal": 10000 },
  { "code": "BBSDN", "name": "DANA (Bebas Nominal)", "open_denom": true, "destination_type": "phone",
    "min": 10000, "max": 10000000, "fee": 50 } ] }
```
Klien mengambil produk dengan `open_denom: true`. Bila tidak ada, cadangan kode: DANA → `BBSDN`, ShopeePay → `BBSSH`
(min 10.000, maks 10.000.000). **`fee` di sini adalah ongkos yang dipotong dari saldo AustinPay milik admin, bukan dari pengguna.**

### 5.8 Withdraw Instant — kirim
`POST /api/instant-withdraw/create`
```json
{ "wallet": "DANA", "product_code": "BBSDN", "phone": "081234567890", "nominal": 10000 }
```
Balasan sukses:
```json
{ "success": true, "message": "Transfer berhasil dikirim", "status": "success", "id": "iw-123" }
```
`status` bisa `success` (selesai), `processing` (masih jalan), atau gagal. Saldo **akun AustinPay** dipotong sebesar
`nominal + fee produk`. Kesalahan khas:
```json
{ "success": false, "message": "Nominal harus antara Rp10.000 - Rp10.000.000" }
{ "success": false, "message": "Saldo tidak mencukupi" }
```
Nominal di bawah Rp10.000 **ditolak** — itu sebabnya biaya penarikan Artapedia ditambahkan *di atas* nominal, bukan dikurangkan.

### 5.9 Withdraw Instant — riwayat
`GET /api/instant-withdraw/history?page=1&limit=20&status=...`
```json
{ "success": true, "total": 1, "page": 1, "limit": 50, "pages": 1,
  "data": [ { "id": "iw-123", "wallet": "DANA", "phone": "081234567890", "product_code": "BBSDN",
    "nominal": 10000, "sell_price": 10050, "status": "success", "provider_response": "ok",
    "createdAt": "...", "updatedAt": "..." } ] }
```
Dipakai penyapu untuk **mencocokkan** penarikan yang hasilnya tidak pasti: sama `wallet` + nomor (dinormalkan jadi `08…`) + `nominal`
+ waktu ≥ 2 menit sebelum dikirim, dan id-nya belum dipakai penarikan lain.

### 5.10 Withdraw biasa (butuh persetujuan AustinPay) — hanya admin
- `GET /api/withdraw/methods` → `{ "success": true, "methods": ["Dana", "BCA"] }`
- `POST /api/withdraw/create`
  ```json
  { "amount": 100000, "method": "Dana", "account_number": "0812...", "account_name": "Nama", "note": "opsional" }
  ```
  → `{ "success": true, "message": "...", "withdraw_id": "w-1" }`

Hanya dipanggil dari endpoint admin dan butuh konfirmasi ulang kode admin.

---

## 6. Webhook `deposit.paid`

AustinPay mengirim `POST` JSON ke alamat webhook. Header:

| Header | Isi |
|---|---|
| `X-AustinPay-Signature` | hex HMAC-SHA256 dari **badan mentah** dengan kunci `AUSTINPAY_WEBHOOK_SECRET` |

Badan:
```json
{ "event": "deposit.paid", "sentAt": "2026-09-24T10:25:00.000Z", "data": { "transactionId": "APG-XXXX" } }
```

Urutan pemeriksaan di server Artapedia (berhenti di langkah pertama yang gagal):
1. Secret belum diisi → **401** "Webhook belum diaktifkan".
2. Tanda tangan tidak cocok (dibandingkan *timing-safe*) → **401**, dan kejadian dicatat sebagai `webhook-austin-palsu` (tingkat tinggi).
3. JSON tidak valid → 400.
4. `sentAt` lebih dari **10 menit** dari sekarang → 400 (anti replay).
5. `event` bukan `deposit.paid` → 200 diabaikan.
6. `transactionId` kosong → 400.
7. Cari di **deposit pengguna** (`provider = qrisfast`, `providerRef = transactionId`); bila tidak ada, cari di **tagihan QRIS Gateway**.
   Tidak ditemukan di keduanya → **200** `{tidakDikenal:true}` (200 supaya AustinPay tidak mengulang selamanya).
8. **Isi webhook tidak dipercaya untuk mengkreditkan.** Sistem selalu menanyakan ulang status ke `GET /api/deposit/check/{id}` dulu.

Webhook hanyalah *pemicu cepat*. Bila tidak sampai, pembayaran tetap terdeteksi oleh polling halaman dan **penyapu cron** (lihat §9).

Verifikasi manual (Node.js):
```js
const sah = crypto.timingSafeEqual(
  Buffer.from(crypto.createHmac("sha256", WEBHOOK_SECRET).update(rawBody).digest("hex")),
  Buffer.from(String(req.headers["x-austinpay-signature"] || "").toLowerCase())
);
```
(Bandingkan panjang buffer lebih dulu — `timingSafeEqual` melempar error bila panjangnya beda.)

---

## 7. Pemetaan status

**Deposit (`/api/deposit/check`) → status internal** (`normalisasiStatusAustin`):

| Dari AustinPay | Internal | Efek |
|---|---|---|
| `paid`, `success`, `completed`, `settlement` | `completed` | **dikreditkan** |
| `expired`, `expire` | `expired` | tagihan ditandai kedaluwarsa |
| `cancel`, `canceled`, `cancelled` | `canceled` | — |
| `failed`, `failure`, `error`, `rejected` | `failed` | — |
| lainnya (mis. `pending`) | `pending` | tetap menunggu |

**Withdraw instant → status internal** (`normalisasiStatusInstan`):

| Dari AustinPay | Internal |
|---|---|
| `success`, `completed`, `paid`, `done` | `sukses` |
| `failed`, `failure`, `error`, `rejected`, `canceled`, `cancelled` | `gagal` |
| lainnya (`processing`, …) | `proses` |

---

## 8. Alur lengkap di Artapedia

### 8.1 Deposit QRIS FAST (saldo nokos)
1. Pengguna memilih nominal → `POST /api/deposit/create` (provider `qrisfast`, atau terpilih lewat **QRIS UTAMA / rute deposit** acak).
2. Server memanggil `POST /api/deposit/create` AustinPay dengan nominal. Dari balasan disimpan: `transaction_id` (`providerRef`),
   `qr_string`, `qr_image`, `expired_at`, `amount` → `totalAmount`, selisih → `adminFee`, `unique_code`.
3. Pengguna membayar **`totalAmount`**.
4. Terdeteksi lewat webhook / polling status / penyapu → `syncDeposit()` menanyakan status → `completed` → saldo **diklaim atomik**
   (flag `credited`) sehingga **tidak pernah dikredit dua kali**; cashback, bonus referral, dan notifikasi (web push, bot, channel) dijalankan.
5. Maks **3 QRIS pending** per akun dalam 30 menit. Batal → `POST /api/deposit/cancel/{id}` diteruskan ke AustinPay.
6. Kegagalan membuat QRIS (401/403/5xx/jaringan) → admin dikabari via Telegram; pengguna melihat pesan ramah dan diarahkan ke metode lain.

### 8.2 Tagihan QRIS Gateway (merchant)
1. Merchant membuat tagihan (dasbor atau `POST /api/gw/v1/invoice`). Nominal Rp2.000 – Rp10.000.000.
2. Server memanggil `POST /api/deposit/create` AustinPay → menyimpan `txnId`, `qrString`, `qrImage`, `bayar` (total yang dibayar pembeli), `kodeUnik`.
3. Pembeli membayar `bayar` (= `pay_amount` di API).
4. Terdeteksi (webhook / cek halaman / penyapu cron) → tagihan **diklaim atomik** + **indeks unik** `gateway_ledger.invoiceId` (dua lapis penjaga kredit ganda).
5. Saldo merchant bertambah **nominal tagihan − Rp250**. Merchant dikabari (bot), admin dikabari, **callback** dikirim ke URL merchant (bila diisi).
6. Tagihan lama dari Pakasir tetap diperiksa ke Pakasir sampai selesai.

### 8.3 Penarikan otomatis (saldo nokos & saldo QRIS Gateway)
Urutan yang menjaga uang — **jangan diubah tanpa memahami tiap langkah**:

1. Dokumen penarikan dicatat dulu (status `disiapkan`).
2. Saldo dipotong **atomik** dengan kunci idempotensi (`wdBayar` / `wdDebit`) → status `baru`. Satu penarikan tidak bisa memotong dua kali.
3. Produk bebas-nominal dibaca (`products`), nominal divalidasi terhadap `min`/`max`.
4. `POST /api/instant-withdraw/create` dikirim → status `dikirim`. Hasil:
   - **sukses** → `done`/`sukses`;
   - **processing** → `proses`, dipantau penyapu;
   - **ditolak tegas** (mis. saldo AustinPay habis, nomor ditolak) → saldo pengguna **dikembalikan sekali** (kunci `wdRefund`/`wdBayar`);
   - **tidak pasti** (`ambigu`: timeout/putus/5xx) → status `tidak-pasti`, saldo **tidak** dikembalikan.
5. **Penyapu** (cron tick) mencocokkan yang `proses`/`tidak-pasti` ke `/history`:
   cocok → ikuti statusnya; tidak ada jejak setelah **10 menit** → dianggap tidak pernah terkirim → saldo dikembalikan penuh (nominal + biaya).
   `proses` lebih dari 30 menit → admin dikabari.
6. **Pemutus arus:** ≥ `WD_PEMUTUS_MAKS` (bawaan 4) masalah penyedia dalam 10 menit → penarikan otomatis **mati sendiri**, admin dikabari lengkap
   dengan penyebab. Saldo Stor Gmail: tombol tarik nonaktif. QRIS Gateway: permintaan baru masuk **antrean manual** admin.
7. Pengaman tambahan: batas per hari, maksimum aktif bersamaan, satu nomor e-wallet tidak boleh dipakai banyak akun, cek gerbang uang
   (mode baca-saja / kunci akun), akun ditangguhkan tidak bisa menarik.

**Aturan angka**

| | Saldo Stor Gmail (`/setor-gmail`) | QRIS Gateway |
|---|---|---|
| Minimal diterima | Rp10.000 | **Rp10.000** |
| Biaya | Rp1.000 | **Rp1.000** |
| Saldo terpotong | nominal + biaya | nominal + biaya (tarik 10.000 → potong 11.000) |
| Maksimal / transaksi | Rp1.000.000 | Rp5.000.000 |
| Batas harian | 5× dan Rp3.000.000 | 10× |
| Sumber saldo | hanya hasil upah **Stor Gmail** | saldo gateway |

Semua angka (kecuali batas gateway) bisa diubah di Admin → Konfigurasi (`WD_SETOR_*`, `GW_WD_MAKS_HARI`).

### 8.4 Notifikasi admin otomatis
Penarikan berhasil/gagal, hasil belum pasti, AustinPay menolak (IP/key/saldo), penarikan otomatis dimatikan sendiri, saldo AustinPay menipis
(maks 1× per 3 jam), pembayaran gateway masuk. Pesan tidak memuat key/secret.

---

## 9. Pekerjaan latar (cron tick)
`GET /api/cron/tick` (header `Authorization: Bearer CRON_SECRET`) menjalankan, antara lain:
- sapuan deposit tertunda (pembayaran yang webhook-nya tidak sampai),
- `sapuWdInstan` (penarikan saldo Stor Gmail) dan `sapuWdGateway` (penarikan gateway),
- `sapuTagihanGateway` (tagihan gateway yang belum terdeteksi + ulang callback),
- peringatan saldo AustinPay menipis.

Di Render, `INTERNAL_CRON=1` menjalankan penjadwal internal; di Vercel lewat `vercel.json`; platform lain pakai cron eksternal.

---

## 10. Troubleshooting

| Gejala | Penyebab umum | Tindakan |
|---|---|---|
| Semua panggilan **403** | IP server belum di-whitelist | Daftarkan IP / pakai `AUSTINPAY_PROXY` |
| **401** "Signature tidak valid" | secret salah, **PATH** ikut query string, body berbeda dari yang ditandatangani, jam server melenceng | Periksa rumus §3 |
| **401** webhook | `AUSTINPAY_WEBHOOK_SECRET` kosong/salah | Samakan dengan dashboard AustinPay |
| Penarikan "Layanan penarikan sedang penuh" | saldo akun AustinPay habis | Isi saldo AustinPay |
| Penarikan status **DICEK** lama | AustinPay sempat timeout | Tunggu penyapu (maks ±10 menit) atau cek riwayat di AustinPay lalu putuskan manual di admin |
| Pembayaran masuk tapi saldo belum | webhook tidak sampai | Penyapu cron akan menangkap; pastikan cron berjalan |
| Pembeli bayar nominal salah | membayar nominal tagihan, bukan `pay_amount` | Tampilkan `pay_amount` (total + kode unik) |
| Penarikan otomatis mati sendiri | pemutus arus aktif | Perbaiki penyebab (lihat notifikasi admin), nyalakan lagi di Konfigurasi |

## 11. Daftar periksa sebelum go-live
- [ ] API key + secret + webhook secret diisi di Konfigurasi.
- [ ] IP server / proxy terdaftar di whitelist AustinPay; **Cek koneksi** di panel hijau.
- [ ] Webhook didaftarkan ke `/api/deposit/austinpay-webhook`.
- [ ] Saldo akun AustinPay cukup untuk penarikan; `AUSTINPAY_SALDO_MIN` sesuai.
- [ ] Cron berjalan (`/api/cron/tick`).
- [ ] Coba 1 deposit kecil, 1 tagihan gateway kecil, dan 1 penarikan Rp10.000 sungguhan; periksa saldo, notifikasi, dan riwayat AustinPay.
