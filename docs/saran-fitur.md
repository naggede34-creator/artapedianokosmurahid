# Saran fitur Artapedia (belum ada di sistem)

Sudah dicek: yang di bawah ini BELUM ada. Yang sudah ada (blokir pengguna, blokir IP, popup admin, editor layar ban, Setor Gmail, Klan, Arena, skin/tema, rute deposit, saringan kata WEARTA, dsb.) sengaja tidak diulang.

## 50 fitur ADMIN

**Keamanan & moderasi**
1. Verifikasi 2 langkah (TOTP) untuk login admin.
2. Daftar perangkat/sesi admin yang aktif + tombol "keluarkan semua".
3. Beberapa akun admin dengan peran (owner, CS, keuangan, moderator).
4. Log audit: siapa mengubah konfigurasi/saldo apa, kapan (tak bisa dihapus).
5. Notifikasi Telegram saat admin login dari IP baru.
6. Daftar putih IP untuk akses /admin.
7. Skor risiko akun (umur, IP kembar, pola deposit/tarik) dengan peringkat "perlu dicek".
8. Deteksi multi-akun per perangkat (sidik jari browser) + tombol gabung/blokir.
9. Antrean laporan pengguna (laporkan pesan/akun) dengan keputusan 1 klik.
10. Banding blokir: pengguna kena ban bisa kirim banding, admin setuju/tolak.
11. Ban sementara otomatis (mis. 24 jam) dengan hitung mundur di layar ban.
12. Strike system: 3 pelanggaran saringan chat = bisu otomatis 1 jam.
13. Kata terlarang per kategori (kasar, penipuan, promosi) dengan tindakan berbeda.
14. Saringan tautan/nomor telepon di WEARTA CHAT (anti iklan/penipuan).
15. Mode "baca-saja" darurat: matikan semua transaksi sekaligus dengan 1 tombol.

**Keuangan**
16. Laporan laba-rugi harian/mingguan/bulanan per produk/penyedia.
17. Rekonsiliasi saldo penyedia vs saldo web (selisih disorot).
18. Peringatan saldo penyedia (Pakasir/QRIS FAST/WarungNokos) menipis.
19. Statistik rute deposit: berapa lewat tiap penyedia, tingkat gagal, waktu rata-rata.
20. Pembobotan rute deposit (mis. 70% Pakasir / 30% QRIS FAST) selain acak rata.
21. Pemutus otomatis penyedia (circuit breaker): 3 gagal beruntun → lewati 10 menit.
22. Biaya admin deposit/penarikan dinamis per jam/hari.
23. Koreksi saldo massal via CSV dengan pratinjau & alasan wajib.
24. Antrean penarikan manual dengan persetujuan 2 admin untuk nominal besar.
25. Ekspor transaksi ke CSV/Excel dengan filter tanggal & penyedia.
26. Batas deposit/tarik harian per pengguna (bisa beda per level).
27. Kupon & kode promo: persen/nominal, kuota, masa berlaku, pemakaian 1×.
28. Cashback berjenjang berdasarkan total deposit bulan ini.
29. Pembukuan manual (catat pengeluaran: server, iklan) untuk hitung laba bersih.
30. Pengingat jatuh tempo (domain, hosting, langganan API).

**Operasional & produk**
31. Jadwal maintenance otomatis (mulai/selesai) + banner hitung mundur.
32. Pesan siaran (broadcast) ke segmen: baru, aktif, tidak aktif 30 hari, saldo besar.
33. Penjadwal popup admin (tayang tanggal X–Y, hanya segmen tertentu).
34. A/B test popup/banner (varian A vs B, lihat klik tertinggi).
35. Manajemen produk massal: ubah harga/markup banyak layanan sekaligus.
36. Aturan markup otomatis per kategori & per level pengguna.
37. Sembunyikan/tampilkan produk terjadwal (mis. promo akhir pekan).
38. Pantauan stok & status layanan penyedia dengan indikator hijau/kuning/merah.
39. Template balasan cepat untuk CS (canned response) di inbox admin.
40. Tiket bantuan: pengguna buat tiket, admin balas, status buka/tutup/SLA.
41. Catatan internal per pengguna (hanya admin yang lihat) + label (VIP, waspada).
42. Segmentasi & label pengguna otomatis (VIP, dormant, pemain game, reseller).
43. Pencarian global admin (Ctrl+K): pengguna, order, deposit, ref transaksi.
44. Cron/sapuan dashboard: lihat kapan terakhir tiap sapuan jalan & hasilnya.
45. Cadangan database terjadwal + tombol pulihkan satu koleksi.
46. Penampil log error server (terkelompok, dengan jumlah kejadian).
47. Mode uji penyedia: tombol "tes koneksi" tiap API key tanpa transaksi nyata.
48. Pelacak webhook: riwayat webhook masuk, status, tombol kirim ulang.
49. Impor/ekspor seluruh konfigurasi (JSON) untuk pindah/cadangan.
50. Dashboard real-time (pengguna online, order/menit, deposit/jam) dengan alarm ambang.

## 50 fitur PENGGUNA

**Akun & keamanan**
1. Login dengan Google / Telegram satu klik.
2. Verifikasi 2 langkah untuk akun pengguna.
3. PIN transaksi sebelum tarik saldo / pembelian besar.
4. Daftar perangkat yang sedang masuk + keluarkan dari jauh.
5. Notifikasi login dari perangkat baru (Telegram/email).
6. Ganti kata sandi & pemulihan akun lewat Telegram.
7. Kunci akun sementara oleh pengguna sendiri ("saya merasa diretas").
8. Verifikasi profil (centang) untuk akun terpercaya.
9. Hapus akun & unduh data pribadi sendiri.
10. Riwayat aktivitas keamanan (login, ganti sandi, tarik saldo).

**Dompet & transaksi**
11. Favorit/produk tersimpan untuk beli ulang cepat.
12. "Beli lagi" 1 klik dari riwayat order.
13. Pengingat deposit pending ("QRIS-mu 5 menit lagi kedaluwarsa").
14. Tagihan/invoice PDF & struk dibagikan sebagai gambar.
15. Target tabungan saldo (progress bar menuju nominal tertentu).
16. Batas belanja harian/bulanan yang diatur sendiri.
17. Kupon/promo: masukkan kode di halaman bayar.
18. Voucher hadiah: kirim saldo/produk ke teman lewat tautan.
19. Transfer saldo antar pengguna (dengan PIN & biaya opsional).
20. Langganan otomatis (mis. paket rutin tiap bulan) bisa dijeda.
21. Riwayat transaksi dengan filter, pencarian, dan ekspor CSV.
22. Grafik pengeluaran bulanan per kategori.
23. Notifikasi push saat order selesai/OTP masuk (PWA push).
24. Pelacak status order tahap demi tahap (diproses → dikirim → selesai).
25. Bantuan cepat: tombol "laporkan masalah order" langsung membuat tiket.

**Sosial & hadiah**
26. Program referral berjenjang (ajak teman → bonus saat mereka deposit).
27. Misi harian/mingguan dengan hadiah (login, deposit, main game).
28. Streak login + hadiah makin besar tiap hari beruntun.
29. Papan peringkat mingguan (deposit, order, menang game) dengan hadiah.
30. Lencana/prestasi yang bisa dipajang di profil.
31. Level & XP pengguna dengan keuntungan per level (diskon kecil).
32. Roda keberuntungan harian gratis.
33. Gacha/kotak misteri dengan saldo/poin.
34. Tukar poin ke saldo/voucher di toko poin.
35. Event musiman dengan misi & hadiah khusus.
36. Teman: tambah teman, lihat status online, kirim hadiah.
37. Profil publik (bio, lencana, statistik game) yang bisa dibagikan.
38. Reaksi emoji & balasan berantai (thread) di WEARTA CHAT.
39. Pesan suara & stiker kustom di WEARTA CHAT.
40. Grup chat dengan peran (admin grup, bisukan anggota) & tautan undangan.

**Kenyamanan**
41. Notifikasi harga turun / stok kembali untuk produk pilihan.
42. Pencarian produk dengan saran otomatis & riwayat pencarian.
43. Bandingkan harga antar layanan sejenis.
44. Mode hemat data (tanpa gambar berat/animasi).
45. Pilihan bahasa (Indonesia/Inggris).
46. Ukuran huruf & kontras tinggi (aksesibilitas).
47. Pintasan beranda yang bisa diatur sendiri (urutan tile).
48. Widget saldo di layar utama (PWA shortcut / app badge).
49. FAQ pintar dengan pencarian + chatbot AI jawab otomatis sebelum ke CS.
50. Ulasan & rating layanan setelah order selesai.

## 50 fitur TAMPILAN WEB

**Tampilan umum**
1. Mode gelap otomatis mengikuti jam (bukan hanya sistem).
2. Banyak tema warna siap pilih (Samudra, Senja, Hutan, Neon) satu klik.
3. Animasi transisi antar halaman halus (view transitions).
4. Skeleton loading di semua daftar (bukan spinner).
5. Pull-to-refresh bergaya aplikasi di PWA.
6. Bilah navigasi bawah (bottom nav) yang bisa disembunyikan saat scroll.
7. Tampilan tablet/desktop dua kolom (daftar + detail) untuk riwayat & chat.
8. Efek kaca (glassmorphism) konsisten di kartu, modal, dan menu.
9. Mikro-interaksi tombol (tekan, getar halus, centang animasi).
10. Haptic feedback (getar) pada aksi penting di HP.
11. Ilustrasi kosong (empty state) yang ramah di setiap daftar kosong.
12. Halaman 404/500 bertema + tombol kembali & pencarian.
13. Splash screen PWA bertema & ikon adaptif.
14. Konfeti saat deposit sukses / naik level.
15. Efek suara UI opsional (sudah ada untuk game; perluas ke seluruh web).

**Beranda & halaman utama**
16. Banner carousel yang diatur admin (jadwal, urutan, tautan).
17. Bagian "Terlaris" & "Baru" di beranda dengan data nyata.
18. Ticker aktivitas langsung ("Rudi baru saja deposit Rp50.000") dengan opsi samarkan.
19. Kartu saldo 3D bisa dibalik (depan: saldo, belakang: aksi cepat).
20. Hitung mundur promo berjalan di beranda.
21. Bagian testimoni/ulasan nyata dengan foto bukti.
22. Statistik publik (total order, pengguna) dengan angka beranimasi.
23. Bagian FAQ ringkas bisa dilipat di beranda.
24. Peta jalan / "Yang baru" (changelog) tampil sebagai kartu.
25. Pintasan kategori berbentuk ikon besar yang bisa digeser.

**Halaman fungsional**
26. Halaman status layanan publik (semua penyedia: normal/gangguan).
27. Halaman deposit dengan stepper (nominal → bayar → selesai) dan timer QRIS besar.
28. QRIS dengan tombol "simpan gambar" & "bagikan" langsung.
29. Halaman order dengan linimasa status vertikal.
30. Filter & urutan produk (harga, terlaris, terbaru) dengan chip.
31. Pencarian global (Ctrl+K / ikon kaca pembesar) di semua halaman.
32. Halaman profil dengan sampul, avatar bingkai, dan statistik kartu.
33. Halaman "Pusat bantuan" dengan kategori & artikel.
34. Halaman syarat/privasi dengan daftar isi tertaut.
35. Halaman referral dengan kartu undangan yang bisa dibagikan sebagai gambar.

**Admin & teknis tampilan**
36. Dasbor admin dengan widget yang bisa diatur/seret (urutan & tampil/sembunyi).
37. Grafik interaktif admin (tooltip, zoom rentang tanggal).
38. Tabel admin dengan kolom bisa disembunyikan, urut, dan pencarian cepat.
39. Mode kompak/lega untuk tabel & daftar admin.
40. Tema admin gelap/terang tersendiri + warna aksen.
41. Pratinjau langsung (live preview) untuk popup, banner, dan layar ban sebelum disimpan.
42. Penyunting tampilan beranda tanpa kode (urutkan seksi, ganti judul/teks).
43. Pustaka ikon & stiker bawaan untuk popup admin.
44. Pelacak "kerusakan tampilan": laporan otomatis error JS/layar putih dari pengguna.
45. Indikator offline/koneksi lambat + antrean aksi saat offline (PWA).
46. Lazy-load gambar dengan blur-up & ukuran responsif otomatis.
47. Audit kontras warna otomatis di semua tema (peringatan bila terlalu pucat).
48. Pengaturan font (sistem/Inter/Poppins) yang diatur admin.
49. Mode perayaan (Ramadan, 17 Agustus, Tahun Baru) dengan dekorasi otomatis berjadwal.
50. Halaman "Install aplikasi" dengan panduan bergambar per perangkat (Android/iOS).
