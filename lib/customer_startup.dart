import 'dart:async';
import 'package:flutter/foundation.dart';
import 'i18n.dart';

/// Non-critical preferences are loaded *after* the first Flutter frame.
/// Device-local storage must never be allowed to gate the customer catalogue.
class CustomerStartup {
  CustomerStartup._();

  static Future<void> restoreLanguage({
    Future<void> Function()? loader,
    Duration deadline=const Duration(seconds:4),
  }) async {
    try {
      await (loader??EasyMandiLanguage.load)().timeout(deadline);
    } catch (error) {
      // Do not log preference contents, tokens, addresses or local database data.
      debugPrint('Easy Mandi: optional language preference unavailable (${error.runtimeType})');
    }
  }
}
