import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:artapedia_app/splash.dart';

void main() {
  testWidgets('layar pembuka tampil dan beranimasi tanpa galat', (WidgetTester tester) async {
    await tester.pumpWidget(const MaterialApp(home: Scaffold(body: SplashLoading(progress: 0.4))));
    await tester.pump(const Duration(milliseconds: 600));
    await tester.pump(const Duration(milliseconds: 1500));
    expect(find.text('A'), findsWidgets);
    expect(find.textContaining('WEARTA CHAT'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
