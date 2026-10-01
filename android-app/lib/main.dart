import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'config.dart';
import 'web_shell.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setPreferredOrientations(<DeviceOrientation>[
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
    DeviceOrientation.landscapeLeft,
    DeviceOrientation.landscapeRight,
  ]);
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Color(warnaDasar),
    statusBarIconBrightness: Brightness.light,
    systemNavigationBarColor: Color(warnaDasar),
    systemNavigationBarIconBrightness: Brightness.light,
  ));
  runApp(const ArtapediaApp());
}

class ArtapediaApp extends StatelessWidget {
  const ArtapediaApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'ARTA PEDIA',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorSchemeSeed: const Color(0xFFFFB31A),
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(warnaDasar),
      ),
      home: const WebShell(),
    );
  }
}
