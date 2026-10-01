import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:path_provider/path_provider.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';

import 'config.dart';
import 'splash.dart';

/// Cangkang aplikasi: WebView layar penuh + layar pembuka animasi.
///  • izin kamera/mikrofon/lokasi diminta saat situs membutuhkannya
///  • tombol Kembali memundurkan halaman (keluar hanya setelah konfirmasi)
///  • unggah berkas (bukti transfer, foto) lewat pemilih berkas
///  • tautan Telegram/WhatsApp/Play Store dibuka di aplikasinya masing-masing
///  • jembatan "ArtapediaApp": situs bisa membagikan gambar/teks lewat menu bagikan Android
///  • layar offline dengan tombol Coba lagi
class WebShell extends StatefulWidget {
  const WebShell({super.key});

  @override
  State<WebShell> createState() => _WebShellState();
}

class _WebShellState extends State<WebShell> with WidgetsBindingObserver {
  late final WebViewController _kontrol;
  double _kemajuan = 0;
  bool _selesaiMuat = false;
  bool _minimumLewat = false;
  bool _galat = false;
  bool _splashHilang = false;
  DateTime? _terakhirKembali;

  bool get _siap => _selesaiMuat && _minimumLewat && !_galat;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    Timer(splashMinimum, () {
      if (mounted) setState(() => _minimumLewat = true);
    });
    _siapkanWebView();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  /// Alamat awal. Tautan dalam (deep link) `https://situs/...` mengisi rute awal.
  Uri _alamatAwal() {
    final String rute =
        WidgetsBinding.instance.platformDispatcher.defaultRouteName;
    final Uri dasar = Uri.parse(siteUrl);
    if (rute.isNotEmpty && rute != '/') {
      final Uri? u = Uri.tryParse(rute);
      if (u != null && u.hasScheme && u.host == dasar.host) return u;
      if (rute.startsWith('/')) return dasar.resolve(rute);
    }
    return dasar;
  }

  void _siapkanWebView() {
    final WebViewController c = WebViewController(
      onPermissionRequest: _izinWeb,
    )
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(warnaDasar))
      ..addJavaScriptChannel('ArtapediaApp', onMessageReceived: _pesanDariSitus)
      ..setNavigationDelegate(
        NavigationDelegate(
          onProgress: (int p) {
            if (mounted) setState(() => _kemajuan = p / 100);
          },
          onPageStarted: (String url) {
            if (mounted) setState(() => _galat = false);
          },
          onPageFinished: (String url) {
            if (mounted) {
              setState(() {
                _selesaiMuat = true;
                _kemajuan = 1;
              });
            }
          },
          onWebResourceError: (WebResourceError e) {
            // Hanya galat halaman utama (bukan gambar/skrip yang gagal).
            if (e.isForMainFrame ?? false) {
              if (mounted) setState(() => _galat = true);
            }
          },
          onNavigationRequest: _tentukanNavigasi,
        ),
      );

    c.getUserAgent().then((String? ua) {
      c.setUserAgent('${ua ?? 'Mozilla/5.0'} $uaSuffix');
    }).whenComplete(() => c.loadRequest(_alamatAwal()));

    final dynamic platform = c.platform;
    if (platform is AndroidWebViewController) {
      AndroidWebViewController.enableDebugging(false);
      platform.setMediaPlaybackRequiresUserGesture(false);
      platform.setOnShowFileSelector(_pilihBerkas);
      platform.setGeolocationPermissionsPromptCallbacks(
        onShowPrompt: (GeolocationPermissionsRequestParams params) async {
          final PermissionStatus s = await Permission.locationWhenInUse.request();
          return GeolocationPermissionsResponse(allow: s.isGranted, retain: true);
        },
      );
    }
    _kontrol = c;
  }

  // ───────────────────────── izin kamera / mikrofon ─────────────────────────
  Future<void> _izinWeb(WebViewPermissionRequest request) async {
    final List<Permission> perlu = <Permission>[];
    for (final WebViewPermissionResourceType t in request.types) {
      if (t == WebViewPermissionResourceType.camera) perlu.add(Permission.camera);
      if (t == WebViewPermissionResourceType.microphone) perlu.add(Permission.microphone);
    }
    if (perlu.isEmpty) {
      await request.deny();
      return;
    }
    final Map<Permission, PermissionStatus> hasil = await perlu.request();
    if (hasil.values.every((PermissionStatus s) => s.isGranted)) {
      await request.grant();
    } else {
      await request.deny();
    }
  }

  // ───────────────────────── unggah berkas ─────────────────────────
  Future<List<String>> _pilihBerkas(FileSelectorParams params) async {
    try {
      final bool gambar = params.acceptTypes.isNotEmpty &&
          params.acceptTypes.every((String t) => t.startsWith('image/') || t == 'image/*');
      final FilePickerResult? hasil = await FilePicker.platform.pickFiles(
        type: gambar ? FileType.image : FileType.any,
        allowMultiple: params.mode == FileSelectorMode.openMultiple,
      );
      if (hasil == null) return <String>[];
      return hasil.paths
          .whereType<String>()
          .map((String p) => Uri.file(p).toString())
          .toList();
    } catch (_) {
      return <String>[];
    }
  }

  // ───────────────────────── navigasi ─────────────────────────
  Future<NavigationDecision> _tentukanNavigasi(NavigationRequest r) async {
    final Uri? u = Uri.tryParse(r.url);
    if (u == null) return NavigationDecision.prevent;
    final String skema = u.scheme.toLowerCase();
    if (skema == 'http' || skema == 'https') {
      final String host = u.host.toLowerCase();
      if (hostLuar.contains(host)) {
        await _bukaLuar(u);
        return NavigationDecision.prevent;
      }
      return NavigationDecision.navigate;
    }
    if (skema == 'about' || skema == 'data' || skema == 'blob' || skema == 'file') {
      return NavigationDecision.navigate;
    }
    // tel:, mailto:, tg:, whatsapp:, intent: … → aplikasi lain
    await _bukaLuar(u);
    return NavigationDecision.prevent;
  }

  Future<void> _bukaLuar(Uri u) async {
    try {
      await launchUrl(u, mode: LaunchMode.externalApplication);
    } catch (_) {}
  }

  // ───────────────────────── jembatan dari situs ─────────────────────────
  /// Pesan JSON dari situs:
  ///  {"aksi":"bagikan-gambar","dataUrl":"data:image/png;base64,...","teks":"..."}
  ///  {"aksi":"bagikan-teks","teks":"...","url":"..."}
  ///  {"aksi":"buka-luar","url":"https://..."}
  Future<void> _pesanDariSitus(JavaScriptMessage m) async {
    try {
      final Object? j = jsonDecode(m.message);
      if (j is! Map<String, dynamic>) return;
      final String aksi = (j['aksi'] ?? '').toString();
      if (aksi == 'bagikan-gambar') {
        final String data = (j['dataUrl'] ?? '').toString();
        final int koma = data.indexOf(',');
        if (!data.startsWith('data:image/') || koma < 0) return;
        final List<int> bita = base64Decode(data.substring(koma + 1));
        final Directory tmp = await getTemporaryDirectory();
        final File f = File('${tmp.path}/kemenangan-artapedia.png');
        await f.writeAsBytes(bita, flush: true);
        await Share.shareXFiles(
          <XFile>[XFile(f.path, mimeType: 'image/png')],
          text: (j['teks'] ?? '').toString(),
        );
      } else if (aksi == 'bagikan-teks') {
        final String teks = (j['teks'] ?? '').toString();
        final String url = (j['url'] ?? '').toString();
        await Share.share(url.isEmpty ? teks : '$teks\n$url');
      } else if (aksi == 'buka-luar') {
        final Uri? u = Uri.tryParse((j['url'] ?? '').toString());
        if (u != null && (u.scheme == 'https' || u.scheme == 'http')) await _bukaLuar(u);
      }
    } catch (_) {
      // pesan rusak diabaikan
    }
  }

  // ───────────────────────── tombol kembali ─────────────────────────
  Future<void> _kembali() async {
    if (await _kontrol.canGoBack()) {
      await _kontrol.goBack();
      return;
    }
    final DateTime sekarang = DateTime.now();
    if (_terakhirKembali != null &&
        sekarang.difference(_terakhirKembali!) < const Duration(seconds: 2)) {
      await SystemNavigator.pop();
      return;
    }
    _terakhirKembali = sekarang;
    if (!mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(const SnackBar(
        content: Text('Tekan sekali lagi untuk keluar'),
        duration: Duration(seconds: 2),
      ));
  }

  Future<void> _coba() async {
    setState(() {
      _galat = false;
      _selesaiMuat = false;
      _kemajuan = 0;
    });
    await _kontrol.loadRequest(_alamatAwal());
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (bool didPop, Object? result) {
        if (!didPop) _kembali();
      },
      child: Scaffold(
        backgroundColor: const Color(warnaDasar),
        body: Stack(
          fit: StackFit.expand,
          children: <Widget>[
            SafeArea(
              bottom: false,
              child: WebViewWidget(controller: _kontrol),
            ),
            if (_galat && !_splashHilang) _LayarOffline(onCoba: _coba),
            if (!_splashHilang)
              IgnorePointer(
                ignoring: _siap,
                child: AnimatedOpacity(
                  opacity: _siap ? 0 : 1,
                  duration: const Duration(milliseconds: 600),
                  curve: Curves.easeOut,
                  onEnd: () {
                    if (_siap && mounted) setState(() => _splashHilang = true);
                  },
                  child: _galat
                      ? const SizedBox.shrink()
                      : SplashLoading(progress: _kemajuan),
                ),
              ),
            if (_galat && _splashHilang) _LayarOffline(onCoba: _coba),
          ],
        ),
      ),
    );
  }
}

class _LayarOffline extends StatelessWidget {
  const _LayarOffline({required this.onCoba});
  final VoidCallback onCoba;

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: const Color(warnaDasar),
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              Image.asset('assets/maskot.webp', width: 150),
              const SizedBox(height: 16),
              const Text(
                'Koneksi terputus',
                style: TextStyle(
                    fontSize: 24, fontWeight: FontWeight.w900, color: Color(0xFFFFD23F)),
              ),
              const SizedBox(height: 8),
              const Text(
                'Elang tidak bisa menjangkau server. Periksa internetmu lalu coba lagi.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.white70),
              ),
              const SizedBox(height: 20),
              FilledButton.icon(
                onPressed: onCoba,
                icon: const Icon(Icons.refresh),
                label: const Text('Coba lagi'),
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFFFFB31A),
                  foregroundColor: const Color(0xFF0B162C),
                  textStyle: const TextStyle(fontWeight: FontWeight.w900),
                  padding: const EdgeInsets.symmetric(horizontal: 26, vertical: 14),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
