# ARTA PEDIA — aplikasi Android (Flutter WebView)

Membungkus situs Artapedia menjadi APK, lengkap dengan **layar pembuka animasi** (sinar komik berputar, maskot elang
memantul, judul muncul huruf demi huruf, bilah muat yang mengikuti kemajuan halaman, tips berganti).

![Layar pembuka](docs/splash-preview.png)

## Fitur aplikasi
- WebView layar penuh; sesi login (localStorage/cookie) tetap tersimpan.
- Izin **kamera, mikrofon, lokasi** diminta hanya saat situs membutuhkannya (panggilan WEARTA CHAT, foto, dll.).
- Tombol **Kembali** memundurkan halaman; di halaman awal perlu ditekan dua kali untuk keluar.
- **Unggah berkas** (bukti transfer, foto profil, status) lewat pemilih berkas Android.
- Tautan Telegram / WhatsApp / Play Store / `tel:` / `mailto:` dibuka di aplikasinya masing-masing.
- **Jembatan `ArtapediaApp`**: situs memanggil menu *Bagikan* Android untuk kartu kemenangan (gambar) dan tautan.
- Layar **offline** dengan tombol *Coba lagi*.
- **Deep link**: membuka `https://<domain-situs>/...` dari aplikasi lain langsung ke halaman itu di dalam aplikasi.

## Cara membangun APK (tanpa memasang apa pun di komputer)
1. Di GitHub: tab **Actions → Build APK Android → Run workflow** (opsional isi alamat situs).
2. Tunggu ±6–10 menit, lalu unduh **artifact `artapedia-apk`** (berisi `artapedia.apk`).
3. Pindahkan ke ponsel, izinkan *Install dari sumber tidak dikenal*, pasang.

Mau lampiran otomatis di *Releases*: `git tag apk-v1.0.0 && git push origin apk-v1.0.0`.

### Membangun di komputer sendiri
```bash
cd android-app
flutter create --platforms=android --org id.artapedia --project-name artapedia_app --no-pub .
python3 tool/siapkan_android.py          # izin, nama, deep link, minSdk, applicationId
flutter pub get
dart run flutter_launcher_icons          # ikon dari assets/ikon.png
flutter build apk --release --dart-define=SITE_URL=https://domainmu.com
# hasil: build/app/outputs/flutter-apk/app-release.apk
```
Folder `android/` sengaja tidak disimpan di repo: dibuat ulang oleh `flutter create` agar selalu cocok dengan versi Flutter terbaru.

## Penandatanganan (signing)
APK dari workflow ini ditandatangani dengan kunci *debug* — cukup untuk dipasang langsung (sideload). Untuk rilis tetap:
1. Buat keystore: `keytool -genkey -v -keystore artapedia.jks -keyalg RSA -keysize 2048 -validity 10000 -alias artapedia`
2. Simpan sebagai GitHub Secrets (`ANDROID_KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`) lalu tambahkan langkah
   signing di workflow (ikuti panduan resmi: https://docs.flutter.dev/deployment/android#sign-the-app).
   **Jangan pernah meng-commit keystore atau passwordnya.**

## Catatan penting
- **Google Play**: situs ini memuat fitur taruhan poin & penarikan uang. Kebijakan Play (perjudian & uang sungguhan) kemungkinan besar
  menolak aplikasinya. Jalur yang realistis: bagikan APK langsung (tautan Release / channel Telegram).
- Notifikasi push web (service worker) tidak berjalan di WebView; notifikasi tetap tampil di dalam situs & lewat bot Telegram.
- Mengubah alamat situs: `--dart-define=SITE_URL=...` (dan variabel `SITE_URL` untuk `tool/siapkan_android.py` agar deep link cocok).
- Mengganti ikon: timpa `assets/ikon.png` (1024×1024) dan `assets/ikon_depan.png` (maskot transparan), lalu `dart run flutter_launcher_icons`.

## Pengembangan
```bash
flutter analyze && flutter test
```
