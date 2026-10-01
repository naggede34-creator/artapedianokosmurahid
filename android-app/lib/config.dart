/// Alamat situs yang dibungkus aplikasi. Bisa diganti saat build:
///   flutter build apk --release --dart-define=SITE_URL=https://domainmu.com
const String siteUrl = String.fromEnvironment(
  'SITE_URL',
  defaultValue: 'https://artapedianokosmurahid.vercel.app',
);

/// Ditambahkan ke User-Agent supaya situs tahu ia dibuka dari aplikasi.
const String uaSuffix = 'ArtapediaApp/1.0';

/// Warna dasar (sama dengan theme_color situs) agar tidak ada kedipan putih.
const int warnaDasar = 0xFF0B162C;

/// Lama minimum layar pembuka tampil (supaya animasinya sempat terlihat).
const Duration splashMinimum = Duration(milliseconds: 2600);

/// Host yang SELALU dibuka di aplikasi lain (bukan di dalam WebView).
const List<String> hostLuar = <String>[
  't.me',
  'telegram.me',
  'telegram.dog',
  'wa.me',
  'api.whatsapp.com',
  'chat.whatsapp.com',
  'play.google.com',
  'instagram.com',
  'www.instagram.com',
  'youtube.com',
  'www.youtube.com',
  'youtu.be',
];
