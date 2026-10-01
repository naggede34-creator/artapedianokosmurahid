import 'package:flutter_test/flutter_test.dart';

import 'package:artapedia_app/config.dart';

void main() {
  test('konfigurasi dasar valid', () {
    expect(Uri.parse(siteUrl).hasScheme, isTrue);
    expect(Uri.parse(siteUrl).host, isNotEmpty);
    expect(hostLuar, contains('t.me'));
    expect(splashMinimum.inMilliseconds, greaterThan(1000));
  });
}
