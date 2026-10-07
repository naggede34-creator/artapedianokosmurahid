# Fitur baru (Okt 2026) — ringkasan & pengaturan

Semua pengaturan di bawah ada di **Admin → Integrasi → Konfigurasi** (cari nama kuncinya; yang bertanda *lanjutan* muncul setelah mencentang "Tampilkan pengaturan lanjutan").

## WarungNokos (Server 1 & Server 2) — API baru `warkosv3`
- Kedua server sekarang memesan lewat satu API: `/api/warkosv3/{countries,services,products,order,status,cancel}` (header `x-api-key`).
- API baru menamai pilihan harga per negara+layanan: **"Server 1"**, **"Server 2"**, … Server Plus menampilkan produk "Server 1"; Server Express menampilkan produk "Server 2" (dst).
  - `WARUNGNOKOS_PISAH_SERVER` = `0` → kedua server menampilkan semua produk.
- Pesanan yang dibuat **sebelum** migrasi tetap bisa dibaca statusnya / dibatalkan lewat API lama (otomatis, sekali coba).
- Katalog dicache di database (30 menit) dan dibangun dengan anggaran waktu supaya tidak timeout di serverless.
- Admin → Konfigurasi → panel "Diagnosa rute deposit" → tombol **Tes koneksi** menguji API key tanpa transaksi nyata.

## Deposit
| Kunci | Fungsi |
|---|---|
| `DEPOSIT_UTAMA_AKTIF` | Satu metode "QRIS UTAMA", penyedia diacak untuk SEMUA nominal |
| `DEPOSIT_UTAMA_POOL` | Daftar penyedia; boleh berbobot: `pakasir:50,warungnokos:30,qrisfast:20,manual:10` |
| `DEPOSIT_RUTE_AKTIF` / `_BATAS_RP` / `_ATAS` / `_BAWAH` | Rute per nominal (≥ batas vs < batas); daftar juga boleh berbobot |
| `DEPOSIT_PENGINGAT_MENIT` | Pengingat QRIS hampir habis (push web + bot), 0 = mati |

## Keamanan & operasional
- `MODE_BACA_SAJA` — tombol darurat: semua transaksi uang ditolak (deposit baru, beli, tarik, transfer, tukar poin, game bertaruhan). Uang yang SUDAH dibayar tetap dikreditkan.
- `KUNCI_AKUN_TUNDA_MENIT` — masa tunggu buka kunci akun (pengguna bisa mengunci akunnya di Profil → Keamanan akun).
- Ban sementara: Admin → Pengguna & Blokir → pilih lama blokir; layar ban menampilkan hitung mundur dan terbuka otomatis.
- `REFERRAL_L2_PERSEN` — bonus referral berjenjang (level 2), 0 = mati.

## Alat Admin (Admin → 🧰 Alat Admin)
Ekspor CSV (deposit, pesanan+laba kotor, penarikan, mutasi) · Koreksi saldo massal (CSV → pratinjau → terapkan, sekali per batch) · Pembukuan & laba bulanan · Pesan siaran ke segmen (lonceng / push / bot) · **Akun admin berperan** (owner, keuangan, CS, moderator — kode berbeda per orang; konfigurasi/API key/backup tetap khusus Owner).

## Publik
- `/status` — status layanan (deposit, QRIS manual, tiap server nokos, penarikan) dari transaksi nyata 60 menit terakhir.
