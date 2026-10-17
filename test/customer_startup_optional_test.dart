import 'dart:async';
import 'package:flutter_test/flutter_test.dart';
import 'package:easy_mandi/customer_startup.dart';

void main() {
  test('Optional language load handles failed platform read', () async {
    await CustomerStartup.restoreLanguage(loader: () async {
      throw StateError('Read unavailable');
    });
  });
  test('Optional language load returns after timeout', () async {
    final pending = Completer<void>();
    await CustomerStartup.restoreLanguage(
      loader: () => pending.future,
      deadline: const Duration(milliseconds: 10),
    ).timeout(const Duration(seconds: 2));
  });
}
