# Dokumentasi Lengkap WarungNokos — dari Deposit sampai Beli Nokos

> **Penting dibaca dulu.** Dokumen ini disusun dari **kode integrasi Artapedia** (`lib/warungnokos.js`, `lib/depositOrderService.js`,
> `lib/depositService.js`, `lib/otpOrderService.js`, `lib/orderReconcile.js`, `lib/jaminan.js`, `lib/gantiNomor.js`) dan dari server
> WarungNokos palsu yang dipakai saat pengujian. Ini **bukan salinan dokumentasi resmi WarungNokos**. Yang tertulis di sini adalah
> endpoint dan field yang **benar-benar dipakai kode** dan sudah dicoba terhadap server palsu — **belum pernah diuji terhadap
> WarungNokos asli**. Cocokkan dengan dokumentasi resmi di dashboard WarungNokos sebelum mengandalkan angka/perilaku tertentu.
>
> **Keamanan:** API key hanya di server. Isi lewat **Admin → Konfigurasi** (terenkripsi). Jangan ditulis di kode atau repo.

---

## 1. Gambaran besar

WarungNokos dipakai untuk dua hal:

1. **Beli nomor OTP (nokos)** — dua "server" di web Artapedia (**Server 1** `warungnokos_s1`, **Server 2** `warungnokos_s2`), keduanya memakai
   satu API: **`/api/warkosv3/*`**.
2. **Deposit QRIS** — salah satu penyedia QRIS (`warungnokos`), lewat **`/api/deposit/*`**.

```
Pengguna ── deposit QRIS ──► saldo Artapedia ── beli nokos ──► nomor + kode OTP
              (WarungNokos / Pakasir / AustinPay / manual)        (WarungNokos warkosv3)
```

API lama (`/api/otp/*` untuk Server 1, `/api/smscode/*` untuk Server 2) **tidak dipakai untuk pembelian baru**. Hanya dipertahankan untuk membaca
status / membatalkan pesanan yang dibuat **sebelum** migrasi (fallback otomatis saat API baru membalas 404).

## 2. Konfigurasi

| Kunci (Admin → Konfigurasi) | Wajib | Keterangan |
|---|---|---|
| `WARUNGNOKOS_APIKEY` | **ya** | API key akun WarungNokos (format `wn-…`). Satu key untuk nokos dan deposit. |
| `WARUNGNOKOS_V3_APIKEY` | tidak | Key khusus API baru bila WarungNokos menerbitkan key terpisah untuk Server 2. Kosong = pakai key di atas. |
| `WARUNGNOKOS_BASE_URL` | tidak | Bawaan `https://warungnokos.web.id`. Ganti hanya bila penyedia pindah alamat. |
| `WARUNGNOKOS_PISAH_SERVER` | tidak | `1` (bawaan): Server 1 hanya menampilkan produk bernama "Server 1", Server 2 hanya "Server 2"/"Server 3"…; `0`: keduanya menampilkan semua produk. |
| `OTP_MARKUP_PERCENT` / markup per server | tidak | Keuntungan di atas harga modal (lihat §7.2). Diatur di Admin. |
| `JAMINAN_PERSEN`, `JAMINAN_MENIT` | tidak | Jaminan OTP berbayar (lihat §8). |
| `DEPOSIT_MIN_AMOUNT`, `DEPOSIT_MAX_AMOUNT` | tidak | Batas deposit (bawaan Rp2.000 – Rp1.000.000). |

Tanpa `WARUNGNOKOS_APIKEY`: halaman beli nokos menampilkan "server tidak tersedia", dan `/api/otp/services` membalas 502.

### Autentikasi
Semua panggilan memakai header:
```
x-api-key: <API key>
accept: application/json
content-type: application/json     (hanya bila ada body)
user-agent: artapedia-nokos/1.0
```
Tidak ada tanda tangan HMAC. Tidak ada webhook untuk deposit maupun order — **semuanya dipantau lewat polling**.

## 3. Format balasan, error, dan percobaan ulang

- Balasan umumnya `{ "success": true, "data": … }`. Kode mengambil `body.data` bila ada.
- **Gagal** bila HTTP ≥ 400 **atau** `success === false`. Pesan diambil dari `message` / `error`.
- HTTP **401/403** → "API key WarungNokos ditolak".
- Error jaringan **dibungkus ulang** (tanpa membawa header `x-api-key` ke log) dan ditandai **`ambiguous = true`**: *tidak ada balasan sama sekali, jadi
  hasil di sisi WarungNokos tidak diketahui* (nomor bisa saja sudah terpesan).
- Hanya **GET** yang diulang otomatis sekali (jeda 0,5 dtk; 1,2 dtk untuk 429) bila status 429 atau ≥ 500. **POST tidak pernah diulang otomatis.**
- Timeout bawaan 25 dtk (lebih pendek untuk pembacaan katalog).

---

## 4. DEPOSIT QRIS WarungNokos

### 4.1 Endpoint

**Buat tagihan** — `POST /api/deposit/create`
```json
{ "amount": 20000, "method": "qris" }
```
Balasan (`data`):
```json
{ "trxId": "TRX123", "qr_string": "00020101...", "qr_image": "data:image/png;base64,...",
  "total": 20150, "expired_at": 1790000000000 }
```
- `trxId` → disimpan sebagai `providerRef`.
- `total` = yang **harus dibayar pembeli** (sudah termasuk biaya). Selisih `total − amount` disimpan sebagai biaya admin.
- `expired_at` = **epoch milidetik** (klien juga menerima detik / string tanggal).
- Maksimal **3 transaksi pending** di sisi WarungNokos.

**Cek status** — `GET /api/deposit/status/{trxId}`
```json
{ "status": "success", "amount": 20000, "detail": { "total": 20150, "fee": 150, "brand_name": "QRIS" } }
```
**Batal** — `POST /api/deposit/cancel` `{ "trxId": "TRX123" }`

### 4.2 Pemetaan status deposit
| Dari WarungNokos | Internal | Efek |
|---|---|---|
| `success`, `completed`, `paid`, `settlement` | `completed` | **dikreditkan** |
| `cancel`, `canceled`, `cancelled` | `canceled` | — |
| `expired`, `expire` | `expired` | — |
| `failed`, `failure`, `error` | `failed` | — |
| lainnya | `pending` | menunggu |

### 4.3 Alur di Artapedia
1. Pengguna memilih nominal. Batas: bawaan **Rp2.000 – Rp1.000.000**; saat **rute deposit** menyala, minimum turun ke **Rp1.000**.
2. Metode dipilih **otomatis** oleh rute (pengguna tidak memilih penyedia), atau memakai mode **QRIS UTAMA** (satu metode, penyedia diacak
   dari `DEPOSIT_UTAMA_POOL`, mis. `warungnokos,pakasir,qrisfast,manual`, dengan bobot). Bawaan rute: nominal **< Rp10.000 → WarungNokos**,
   **≥ Rp10.000 → Pakasir / AustinPay** (diacak); kelompok lain jadi cadangan. Penyedia yang gagal otomatis dilewati ke berikutnya.
3. `createWarungNokosDeposit(nominal, "qris")` dipanggil. Gagal 401/5xx → admin dikabari via Telegram; pengguna diarahkan ke metode lain.
4. Disimpan: `providerRef = trxId`, QR, `expiredAt`, `totalAmount`, `adminFee`. Pengguna membayar `totalAmount` memakai e-wallet/m-banking mana pun.
5. **Deteksi pembayaran (tanpa webhook):**
   - halaman deposit **polling** `/api/deposit/status` tiap beberapa detik;
   - bot Telegram memeriksa deposit tertunda tiap pemilik membuka bot;
   - **penyapu cron** (`sapuDepositTertunda`) memeriksa semua yang pending;
   - tiap pemeriksaan = `GET /api/deposit/status/{trxId}` → `syncDeposit()`.
6. Status `completed` → saldo **diklaim atomik** (flag `credited`) → **tidak mungkin dikredit dua kali** walau polling, bot, dan cron bersamaan.
   Lalu: cashback deposit, bonus referral (deposit pertama), catatan mutasi, notifikasi (push web, bot, channel), pengingat QRIS dihentikan.
7. Maks **3 QRIS pending per akun** dalam 30 menit. Batal dari web → diteruskan ke `POST /api/deposit/cancel`.
8. Pengingat otomatis: `DEPOSIT_PENGINGAT_MENIT` (bawaan 5) menit sebelum QRIS kedaluwarsa (push web + bot).

### 4.4 Via API publik Artapedia
`GET /api/v1/deposit/methods`, `POST /api/v1/deposit` (`{ "amount": 20000, "provider": "warungnokos" }`), `GET /api/v1/deposit?order_id=…`,
`POST /api/v1/deposit/cancel`. QRIS manual tidak tersedia lewat API. Batas: 6 pembuatan deposit / menit per API key.

---

## 5. KATALOG nokos (`/api/warkosv3/*`)

| Endpoint | Query | Fungsi |
|---|---|---|
| `GET /api/warkosv3/countries` | — | Daftar negara: `id`, `name`, `dial_code` |
| `GET /api/warkosv3/services` | `country_id` | Layanan di satu negara: `id`, `name` |
| `GET /api/warkosv3/products` | `country_id`, `service_id` | Pilihan harga: `id`, `name` ("Server 1", "Server 2", …), `price` = **harga modal final** |

Perilaku yang perlu diketahui:
- Layanan ditanyakan **per negara**, sedangkan web memilih **layanan dulu baru negara**. Maka layanan semua negara digabung berdasarkan **nama
  yang disederhanakan** (`"WhatsApp"` → `whatsapp`) sebagai kode layanan di Artapedia. Saat order, kode itu diterjemahkan lagi ke `service_id` milik
  tiap negara.
- API **tidak melaporkan stok**: produk yang muncul dianggap tersedia (`stock: null`).
- **Cache berlapis** supaya tidak membanjiri provider: negara/layanan 10 menit di memori + 30 menit di database (`wn_katalog`, supaya instance
  serverless baru tidak mengulang puluhan panggilan); produk 2 menit. Katalog dibangun paralel (4 sekaligus) dengan anggaran 20 dtk; bila kena
  **429** berhenti dan dilanjutkan di muatan berikutnya. Bila provider sedang bermasalah, katalog tersimpan terakhir dipakai.
- **Pemisahan server** (`WARUNGNOKOS_PISAH_SERVER=1`): produk bernama mengandung angka N ≥ 2 → Server 2; selain itu → Server 1.
- Tiap produk dijadikan satu pilihan harga dengan **`key = "{product_id}:{service_id}:{country_id}"`** — cukup untuk order, tidak perlu pencarian lagi.
- Pilihan diurutkan **termurah dulu**; produk berharga ≤ 0 dibuang.

Via API publik Artapedia: `GET /api/v1/servers`, `GET /api/v1/services?server=…`, `GET /api/v1/countries?service_id=…&server=…`.

---

## 6. ORDER nokos (`/api/warkosv3/order`, `/status`, `/cancel`)

**Pesan nomor** — `POST /api/warkosv3/order`
```json
{ "country_id": 6, "service_id": 1, "product_id": 765693933, "service_name": "WhatsApp" }
```
Harga **tidak dikirim** — dihitung ulang di server WarungNokos dari saldo akun WarungNokos kita. Balasan (`data`):
```json
{ "trxId": "ORD-1", "phoneNumber": "628123456789", "amount": 3900, "serviceName": "WhatsApp" }
```
`trxId` = id pesanan di semua tempat (juga jadi `orderId` di Artapedia).

**Cek status** — `GET /api/warkosv3/status/{trxId}`
```json
{ "status": "completed", "otp_code": "123456" }
```
Status mentah: `waiting` → `completed` | `canceled` (juga dikenal `expired`, `failed`). Bila API baru membalas **404**, ditanyakan sekali ke API lama
(`/api/otp/status/…` untuk Server 1, `/api/smscode/status/…` untuk Server 2).

**Batalkan** — `POST /api/warkosv3/cancel` `{ "trxId": "ORD-1" }`
Baru bisa **±3 menit** setelah order. Saldo di sisi WarungNokos dikembalikan otomatis oleh mereka. Fallback pesanan lama: `/api/smscode/cancel`
atau `/api/otp/set_status` (`action_status: "cancel"`).

### Pemetaan status order
| Mentah | Internal | Arti |
|---|---|---|
| `completed`/`success`/`done` **+ ada kode** | `done` | OTP masuk |
| `completed` tanpa kode | `completed` | tunggu kodenya terbaca |
| `canceled`/`cancelled`/`cancel` | `canceled` | dibatalkan → **refund** |
| `expired`/`timeout` | `expired` | kedaluwarsa → **refund** |
| `failed`/`error` | `failed` | — |
| lainnya (`waiting`) | `pending` | menunggu |

Kode OTP dibaca dari `otp_code`/`code`/`sms_code`/`otpCode`/`full_sms`/`verification_code`, atau dari teks SMS (`sms`, `message`, …): format
WhatsApp `123-456` digabung jadi `123456`, selain itu angka 3–8 digit pertama. Nilai kosong / `-` / `null` diabaikan.

---

## 7. ALUR BELI NOKOS di Artapedia (dari klik sampai OTP)

### 7.1 Pilih
`Server → Layanan → Negara → pilihan harga` (web `/otp`, bot Telegram, atau API v1). Server yang dimatikan admin tidak dikirim sama sekali ke klien.

### 7.2 Harga
```
hargaSitus = ceil( hargaModal × (1 + markupServer/100) )          // markup server, atau markup global bila kosong
```
**Bot reseller:** `hargaAkhir` = harga modal grosir reseller + markup reseller (dibatasi batas paketnya); selisih dengan harga situs menjadi **komisi**
reseller. **Jaminan OTP** (opsional) ditambahkan: lihat §8. `totalBayar = hargaAkhir + biayaJaminan`.

Harga **selalu dihitung ulang di server** dari katalog saat order — tidak pernah dari body request.

### 7.3 Pembelian (`placeOtpOrder`) — urutan yang menjaga saldo
1. Validasi: kode akun, layanan, server dikenal, negara dipilih; akun tidak ditangguhkan; **gerbang uang** (mode baca-saja / kunci akun) lolos; server tidak dimatikan.
2. Tentukan harga & cek stok (`outOfStock` bila produk hilang dari katalog).
3. **Hold** dicatat **sebelum** saldo dipotong (jejak untuk penyapu bila proses mati di tengah).
4. Saldo dipotong **atomik** (`balance ≥ totalBayar` di dalam filter). Tidak cukup → hold dibatalkan tanpa kredit, jawaban memuat `kurang` dan
   `nominalTopup` (tombol "Top-up sekarang" dengan nominal yang pas).
5. Bagian **deposit** dari potongan dicatat (bonus dipakai lebih dulu) supaya refund mengembalikan bagian yang sama.
6. `POST /api/warkosv3/order`. Hasil:
   - **berhasil** → lanjut;
   - **ditolak jelas** (stok habis / saldo provider habis / dll.) → coba **cadangan**: produk lain di negara yang sama, modalnya boleh sedikit lebih mahal
     **selama ≤ 97% dari harga yang dibayar pembeli** (untung minimal 3%, tidak pernah rugi). Semua gagal → hold dikembalikan, pesan:
     "…Saldo tidak terpotong, coba negara/server lain.";
   - **tidak ada balasan** (timeout/putus, `ambiguous`) → **tidak mencoba cadangan** (nomor pertama bisa saja sudah terpesan; mencoba lagi = bayar dua nomor).
   Pesan "Not enough balance" dari provider = **saldo akun WarungNokos admin** yang habis (bukan saldo pembeli): admin dikabari (maks 1×/10 menit/server).
7. Pesanan disimpan (`orderId`, `phoneNumber`, `price`, `basePrice`/modal, `providerKey` yang benar-benar dipakai, `expiredAt` = **+20 menit**, dst.).
8. Hold ditandai terpakai **sesudah** pesanan tersimpan; komisi reseller dicatat; mutasi saldo ditulis; notifikasi (admin, channel publik tanpa data pribadi,
   bot pemilik reseller).

### 7.4 Menunggu OTP — `reconcileOtpOrder`
Dipanggil dari: polling halaman/bot, API status, dan **cron** (supaya pesanan yang tidak pernah dibuka lagi tetap beres).
- Pesanan yang sudah direfund tidak pernah menampilkan kode yang telat masuk.
- Lewat `expiredAt` → dianggap `expired`. Selain itu → `GET /api/warkosv3/status/{trxId}`.
- **OTP masuk** → status `done`, kode disimpan, total belanja dicatat, notifikasi: push web, bot (dengan rekomendasi layanan lain), channel, pemilik bot reseller.
- **Canceled / expired** → **refund otomatis** (klaim atomik `refunded:false`, jadi tidak mungkin ganda): saldo kembali **penuh** (harga + biaya jaminan),
  komisi reseller ditarik kembali, mutasi `otp_refund`, notifikasi.

### 7.5 Batal oleh pengguna — `cancelOtpOrder`
1. Hanya pemilik. Sudah direfund → balasan sukses tanpa efek. Sudah ada OTP → ditolak.
2. Sedang diganti jaminan → ditolak sementara.
3. **Minimal 3 menit** sejak pembelian (`CANCEL_COOLDOWN_MS`) — aturan provider.
4. Status **dicek ke provider dulu** sebelum refund (agar tidak mungkin dapat OTP *dan* refund sekaligus). Kode baru masuk → 409 "tidak bisa dibatalkan".
5. `POST /api/warkosv3/cancel`; kegagalan cancel di provider **tidak** menghalangi refund lokal (dicatat di log).
6. Klaim atomik (`refunded:false, otpCode:null`) → saldo kembali, komisi reseller ditarik.

### 7.6 Ganti nomor
Tombol "Ganti Nomor" (`/api/otp/replace`) dan jaminan otomatis memakai fungsi yang sama (`beliNomorPengganti`): produk & harga diambil ulang,
dipesan ke produk yang sama; modal penggantinya tidak boleh lebih mahal dari batas (`hargaMaks`) agar toko tidak rugi.

---

## 8. JAMINAN OTP (opsional, berbayar)

- Biaya = `JAMINAN_PERSEN`% dari harga nomor (bawaan **10%**, maks 50%), minimal **Rp100**, dibulatkan ke atas ke kelipatan **Rp50**.
  `JAMINAN_PERSEN=0` mematikan jaminan.
- Dipotong bersama harga nomor di **hold yang sama** (semua jalur refund menangkapnya).
- Bila kode belum masuk setelah `JAMINAN_MENIT` menit (bawaan & minimum **4**, karena provider baru mau membatalkan setelah ±3 menit), sistem:
  membatalkan nomor lama di provider → membeli nomor pengganti (**sekali per pesanan**, modal ≤ nomor semula).
  Pembatalan lama **tidak jelas / ditolak** → **tidak** membeli nomor kedua (menghindari bayar dua kali).
- Biaya jaminan **hanya jadi milik toko bila OTP akhirnya masuk**. Semua jalur uang kembali (batal, kedaluwarsa, penggantian gagal) mengembalikan **harga + biaya**.
- Selama diganti, pesanan terkunci dari refund jalur lain; klaim yang macet > 5 menit dianggap mati dan boleh direfund.

---

## 9. API publik Artapedia untuk developer (ringkas)

Auth: `Authorization: Bearer <API key Artapedia>` (atau `?api_key=`). Dokumentasi interaktif: **/api-docs**.

| Endpoint | Fungsi |
|---|---|
| `GET /api/v1/me` | saldo & profil |
| `GET /api/v1/servers` | daftar server aktif |
| `GET /api/v1/services?server=` | layanan |
| `GET /api/v1/countries?service_id=&server=` | negara + pilihan harga |
| `POST /api/v1/order` | beli nomor — body: `serviceId`, `countryId`, `providerId`, `serviceName`, `countryName`, `server`, `jaminan` (token **selalu** dari API key, bukan body) |
| `GET /api/v1/orders?limit=&page=` | riwayat |
| `GET /api/v1/orders/status?order_id=` | status & OTP |
| `POST /api/v1/orders/cancel` | `{ "order_id": "…" }` |
| `GET /api/v1/deposit/methods`, `POST /api/v1/deposit`, `GET /api/v1/deposit?order_id=`, `POST /api/v1/deposit/cancel` | deposit |

Batas per API key: **60 permintaan/menit** (semua), **20/menit** untuk order dan pembatalan, **6/menit** untuk membuat deposit. Header respons:
`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, dan `Retry-After` pada 429.

---

## 10. Pekerjaan latar & pemulihan

`GET /api/cron/tick` (header `Authorization: Bearer CRON_SECRET`) menjalankan: rekonsiliasi pesanan `pending` yang macet, refund otomatis,
sapuan deposit tertunda, sapuan **hold** yang menggantung (potongan tanpa pesanan dikembalikan), pemantauan stok ("kabari saya kalau stok ada"),
siaran, dll. **Pastikan cron berjalan** — itu yang menjamin refund dan kredit tidak bergantung pada pengguna membuka halaman.

## 11. Troubleshooting

| Gejala | Penyebab umum | Tindakan |
|---|---|---|
| Halaman beli kosong / 502 di `/api/otp/services` | `WARUNGNOKOS_APIKEY` belum diisi / ditolak | Isi key; Admin → tombol **Diagnosa WarungNokos** |
| "Not enough balance" saat pembeli membeli | **saldo akun WarungNokos** habis | Isi saldo di WarungNokos (admin dikabari otomatis) |
| Layanan/negara lambat muncul pertama kali | katalog dibangun dari banyak panggilan | normal; tersimpan 30 menit di database |
| Server 2 kosong | produk bernama "Server 2" tidak ada untuk layanan itu | cek `WARUNGNOKOS_PISAH_SERVER`; atau memang tidak ada stok |
| Tidak bisa batal | belum 3 menit / OTP sudah masuk | tunggu; kode masuk berarti tidak bisa dibatalkan |
| Saldo terpotong tapi tidak ada nomor | proses mati di tengah | penyapu hold mengembalikan otomatis dalam beberapa menit |
| Deposit sudah bayar tapi belum masuk | WarungNokos tidak punya webhook | tunggu polling/cron; pastikan cron berjalan |

Tombol **Diagnosa** di Admin menjalankan rantai seperti alur beli (negara → layanan → produk) dan melaporkan koneksi tanpa membocorkan key.

## 12. Daftar periksa sebelum go-live
- [ ] `WARUNGNOKOS_APIKEY` (dan `WARUNGNOKOS_V3_APIKEY` bila terpisah) diisi; **Diagnosa** hijau.
- [ ] Saldo akun WarungNokos cukup untuk modal pembelian.
- [ ] Markup global/per server dan persen jaminan sudah sesuai target untung.
- [ ] Cron berjalan.
- [ ] Coba: 1 deposit kecil sampai saldo masuk; 1 pembelian sampai OTP masuk; 1 pembatalan setelah 3 menit; periksa refund dan notifikasi.
