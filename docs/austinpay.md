# AustinPay — QRIS FAST & penarikan otomatis

Fitur: metode deposit **QRIS FAST**, penarikan otomatis saldo **Stor Gmail** ke e-wallet, serta panel admin **AustinPay** (saldo, tarik saldo, riwayat).

## Pasang (sekali)
1. Dasbor Admin → **AustinPay** → isi **API key**, **API secret**, **Webhook secret** (tersimpan terenkripsi; tidak pernah ditampilkan lagi).
   - Alternatif: Environment Variables Vercel `AUSTINPAY_APIKEY`, `AUSTINPAY_APISECRET`, `AUSTINPAY_WEBHOOK_SECRET`.
2. Di dashboard AustinPay → **Webhook**: URL `https://DOMAIN-KAMU/api/deposit/austinpay-webhook` (event `deposit.paid`).
3. **IP whitelist** (wajib di AustinPay): Vercel tidak punya IP keluar tetap. Pilih salah satu:
   - Vercel **Static IPs** lalu daftarkan IP-nya di Profil AustinPay → Whitelist IP, atau
   - VPS ber-IP tetap sebagai proxy → isi `AUSTINPAY_PROXY` (`http://user:pass@host:port`) dan daftarkan IP VPS.
4. Klik **Cek koneksi** di panel. Nyalakan metode **QRIS FAST** di tab deposit/pengaturan bila perlu (otomatis tampil bila key terisi).

## Aturan bawaan (bisa diubah di panel AustinPay)
| Pengaturan | Bawaan |
|---|---|
| Tarik saldo Stor Gmail: minimal diterima | Rp10.000 |
| Biaya admin tarik saldo Stor Gmail | Rp1.000 |
| Maks tarik / akun / hari | 5× (dan Rp3.000.000) |
| Akun baru boleh menarik setelah | 1 jam |
| Maks akun berbeda per nomor tujuan | 2 |

Hanya saldo hasil **deposit** yang bisa ditarik (bonus/hadiah tidak). Poin game tetap punya syarat perputaran.

## Keselamatan uang
- Saldo dipotong **atomik** sebelum dikirim; gagal tegas → dikembalikan sekali (idempoten).
- Hasil **tidak pasti** (timeout/putus/5xx) tidak langsung dikembalikan; dicocokkan ke riwayat AustinPay oleh penyapu (cron tick / lalu lintas web). Tidak ada jejak setelah 10 menit → baru dikembalikan.
- **Pemutus arus**: ≥4 masalah penyedia dalam 10 menit → penarikan otomatis mati sendiri + admin dikabari.
- Penarikan saldo AustinPay oleh admin wajib konfirmasi ulang **kode admin**.
- Webhook diverifikasi HMAC + status dicek ulang ke AustinPay sebelum saldo dikreditkan.
