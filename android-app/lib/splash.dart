import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';

import 'config.dart';

const List<String> _tips = <String>[
  'Memanggil elang…',
  'Menyiapkan nomor OTP murah…',
  'Mengasah jurus Arena Pendekar…',
  'Menyalakan WEARTA CHAT…',
  'Menghitung diskon event…',
  'Hampir siap, sebentar lagi!',
];

/// Layar pembuka animasi bergaya komik: sinar berputar, maskot elang memantul,
/// judul muncul huruf demi huruf, bilah muat bergaris, dan tips yang berganti.
class SplashLoading extends StatefulWidget {
  const SplashLoading({super.key, this.progress = 0});

  /// 0..1 — kemajuan muat halaman (nyata, dari WebView).
  final double progress;

  @override
  State<SplashLoading> createState() => _SplashLoadingState();
}

class _SplashLoadingState extends State<SplashLoading>
    with TickerProviderStateMixin {
  late final AnimationController _putar =
      AnimationController(vsync: this, duration: const Duration(seconds: 14))
        ..repeat();
  late final AnimationController _masuk = AnimationController(
      vsync: this, duration: const Duration(milliseconds: 1500))
    ..forward();
  late final AnimationController _lompat = AnimationController(
      vsync: this, duration: const Duration(milliseconds: 1100))
    ..repeat(reverse: true);
  late final AnimationController _garis =
      AnimationController(vsync: this, duration: const Duration(milliseconds: 900))
        ..repeat();
  int _tip = 0;
  Timer? _ganti;

  @override
  void initState() {
    super.initState();
    _ganti = Timer.periodic(const Duration(milliseconds: 1100), (Timer t) {
      if (mounted) setState(() => _tip = (_tip + 1) % _tips.length);
    });
  }

  @override
  void dispose() {
    _ganti?.cancel();
    _putar.dispose();
    _masuk.dispose();
    _lompat.dispose();
    _garis.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final Size ukuran = MediaQuery.of(context).size;
    final double lebarMaskot = math.min(ukuran.width * 0.62, 280);
    const String judul = 'ARTA PEDIA';
    return ColoredBox(
      color: const Color(warnaDasar),
      child: Stack(
        fit: StackFit.expand,
        children: <Widget>[
          // gradasi latar
          const DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: <Color>[Color(0xFF0B162C), Color(0xFF1B2A5A), Color(0xFF3A1450)],
              ),
            ),
          ),
          // sinar komik berputar
          AnimatedBuilder(
            animation: _putar,
            builder: (BuildContext c, Widget? w) => CustomPaint(
              painter: _SinarPainter(_putar.value * 2 * math.pi),
            ),
          ),
          // titik halftone
          CustomPaint(painter: _TitikPainter()),
          SafeArea(
            child: Column(
              children: <Widget>[
                const Spacer(flex: 2),
                // maskot: masuk memantul + melayang naik-turun
                AnimatedBuilder(
                  animation: Listenable.merge(<Listenable>[_masuk, _lompat]),
                  builder: (BuildContext c, Widget? w) {
                    final double t = Curves.elasticOut
                        .transform(_masuk.value.clamp(0.0, 1.0));
                    final double naik = -10 * Curves.easeInOut.transform(_lompat.value);
                    return Transform.translate(
                      offset: Offset(0, naik + (1 - t) * 80),
                      child: Transform.scale(
                        scale: 0.3 + 0.7 * t,
                        child: Opacity(
                          opacity: _masuk.value.clamp(0.0, 1.0),
                          child: Stack(
                            alignment: Alignment.center,
                            children: <Widget>[
                              Container(
                                width: lebarMaskot * 1.05,
                                height: lebarMaskot * 1.05,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  gradient: RadialGradient(colors: <Color>[
                                    const Color(0xFFFFD23F).withValues(alpha: 0.55),
                                    Colors.transparent,
                                  ]),
                                ),
                              ),
                              Image.asset('assets/maskot.webp',
                                  width: lebarMaskot, fit: BoxFit.contain),
                            ],
                          ),
                        ),
                      ),
                    );
                  },
                ),
                const SizedBox(height: 18),
                // judul huruf-per-huruf
                AnimatedBuilder(
                  animation: _masuk,
                  builder: (BuildContext c, Widget? w) {
                    final List<Widget> huruf = <Widget>[];
                    for (int i = 0; i < judul.length; i++) {
                      final double mulai = 0.25 + i * 0.05;
                      final double t = ((_masuk.value - mulai) / 0.3).clamp(0.0, 1.0);
                      final double e = Curves.easeOutBack.transform(t);
                      huruf.add(Opacity(
                        opacity: t,
                        child: Transform.translate(
                          offset: Offset(0, (1 - e) * 26),
                          child: Transform.scale(
                            scale: 0.4 + 0.6 * e,
                            child: _HurufKomik(judul[i]),
                          ),
                        ),
                      ));
                    }
                    return Row(mainAxisSize: MainAxisSize.min, children: huruf);
                  },
                ),
                const SizedBox(height: 6),
                const Text(
                  'Nomor OTP • Deposit • Game • WEARTA CHAT',
                  style: TextStyle(
                      color: Color(0xFFFFE7A1),
                      fontSize: 12.5,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.4),
                ),
                const Spacer(),
                // bilah muat
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 44),
                  child: AnimatedBuilder(
                    animation: _garis,
                    builder: (BuildContext c, Widget? w) => _BilahMuat(
                      nilai: widget.progress,
                      geser: _garis.value,
                    ),
                  ),
                ),
                const SizedBox(height: 14),
                AnimatedSwitcher(
                  duration: const Duration(milliseconds: 350),
                  child: Text(
                    _tips[_tip],
                    key: ValueKey<int>(_tip),
                    style: const TextStyle(
                        color: Colors.white70,
                        fontSize: 13,
                        fontWeight: FontWeight.w600),
                  ),
                ),
                const Spacer(),
                const Padding(
                  padding: EdgeInsets.only(bottom: 14),
                  child: Text('artapedia.id',
                      style: TextStyle(color: Colors.white38, fontSize: 11)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _HurufKomik extends StatelessWidget {
  const _HurufKomik(this.h);
  final String h;

  @override
  Widget build(BuildContext context) {
    if (h == ' ') return const SizedBox(width: 14);
    const TextStyle dasar = TextStyle(
      fontSize: 40,
      fontWeight: FontWeight.w900,
      letterSpacing: 1,
      height: 1.05,
    );
    return Stack(
      children: <Widget>[
        Text(
          h,
          style: dasar.copyWith(
            foreground: Paint()
              ..style = PaintingStyle.stroke
              ..strokeWidth = 8
              ..strokeJoin = StrokeJoin.round
              ..color = const Color(0xFF05080F),
          ),
        ),
        Text(h, style: dasar.copyWith(color: const Color(0xFFFFD23F))),
      ],
    );
  }
}

class _BilahMuat extends StatelessWidget {
  const _BilahMuat({required this.nilai, required this.geser});
  final double nilai;
  final double geser;

  @override
  Widget build(BuildContext context) {
    // Selalu terlihat bergerak: minimum 8% + animasi garis, naik mengikuti kemajuan nyata.
    final double isi = (0.08 + nilai * 0.92).clamp(0.08, 1.0);
    return Container(
      height: 22,
      decoration: BoxDecoration(
        color: const Color(0xFF05080F),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFFFFFFF), width: 2.5),
        boxShadow: const <BoxShadow>[
          BoxShadow(color: Color(0xAA000000), offset: Offset(0, 4)),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(11),
        child: Align(
          alignment: Alignment.centerLeft,
          child: FractionallySizedBox(
            widthFactor: isi,
            heightFactor: 1,
            child: CustomPaint(painter: _GarisPainter(geser)),
          ),
        ),
      ),
    );
  }
}

class _GarisPainter extends CustomPainter {
  _GarisPainter(this.geser);
  final double geser;

  @override
  void paint(Canvas canvas, Size size) {
    canvas.drawRect(
      Offset.zero & size,
      Paint()
        ..shader = const LinearGradient(
          colors: <Color>[Color(0xFFFFB31A), Color(0xFFFF6B35)],
        ).createShader(Offset.zero & size),
    );
    final Paint garis = Paint()..color = const Color(0x33FFFFFF);
    const double lebar = 16;
    for (double x = -lebar * 2 + geser * lebar * 2; x < size.width + lebar; x += lebar * 2) {
      final Path p = Path()
        ..moveTo(x, size.height)
        ..lineTo(x + lebar, size.height)
        ..lineTo(x + lebar + size.height, 0)
        ..lineTo(x + size.height, 0)
        ..close();
      canvas.drawPath(p, garis);
    }
  }

  @override
  bool shouldRepaint(_GarisPainter old) => old.geser != geser;
}

class _SinarPainter extends CustomPainter {
  _SinarPainter(this.sudut);
  final double sudut;

  @override
  void paint(Canvas canvas, Size size) {
    final Offset pusat = Offset(size.width / 2, size.height * 0.36);
    final double r = size.longestSide * 1.1;
    const int n = 20;
    final Paint cat = Paint()..color = const Color(0x14FFFFFF);
    for (int i = 0; i < n; i += 2) {
      final double a0 = sudut + i * 2 * math.pi / n;
      final double a1 = sudut + (i + 1) * 2 * math.pi / n;
      final Path p = Path()
        ..moveTo(pusat.dx, pusat.dy)
        ..lineTo(pusat.dx + r * math.cos(a0), pusat.dy + r * math.sin(a0))
        ..lineTo(pusat.dx + r * math.cos(a1), pusat.dy + r * math.sin(a1))
        ..close();
      canvas.drawPath(p, cat);
    }
  }

  @override
  bool shouldRepaint(_SinarPainter old) => old.sudut != sudut;
}

class _TitikPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final Paint cat = Paint()..color = const Color(0x0DFFFFFF);
    const double jarak = 22;
    int baris = 0;
    for (double y = 0; y < size.height; y += jarak, baris++) {
      for (double x = baris.isEven ? 0 : jarak / 2; x < size.width; x += jarak) {
        canvas.drawCircle(Offset(x, y), 2.2, cat);
      }
    }
  }

  @override
  bool shouldRepaint(_TitikPainter old) => false;
}
