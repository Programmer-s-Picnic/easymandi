import 'local_store.dart';

/// Normalize previously purchased items from either the customer's server-side
/// aggregation or the authenticated full order ledger.
class RecentOrderItems {
  static int _quantity(dynamic raw) {
    final value = raw is num ? raw.toInt() : int.tryParse('$raw');
    if (value == null || value < 1) return 1;
    return value > 999999 ? 999999 : value;
  }

  static String _text(dynamic value) =>
      value is String ? value.trim() : '';

  static List<RecentItem> fromCustomerData(dynamic source) {
    if (source is! List) return <RecentItem>[];
    final found = <String, RecentItem>{};
    for (final raw in source) {
      if (raw is! Map) continue;
      final id = _text(raw['product_id']);
      if (id.isEmpty || found.containsKey(id)) continue;
      final name = _text(raw['name']);
      if (name.isEmpty) continue;
      found[id] = RecentItem(
        productId: id,
        name: name,
        unit: _text(raw['unit']),
        emoji: '🥬',
        quantity: _quantity(raw['quantity']),
        requestedAt: DateTime.tryParse("${raw['last_ordered'] ?? ''}")
                ?.millisecondsSinceEpoch ??
            0,
      );
      if (found.length >= 20) break;
    }
    return found.values.toList(growable: false);
  }

  /// Fallback when the aggregate is temporarily unavailable.
  /// Items remain newest first. Do not include cancelled orders.
  static List<RecentItem> fromOrderHistory(dynamic source) {
    if (source is! List) return <RecentItem>[];
    final found = <String, RecentItem>{};
    for (final raw in source) {
      if (raw is! Map) continue;
      if (_text(raw['status']).toLowerCase() == 'cancelled') continue;
      final millis = DateTime.tryParse("${raw['created_at'] ?? ''}")
              ?.millisecondsSinceEpoch ??
          0;
      final lines = raw['items'];
      if (lines is! List) continue;
      for (final item in lines) {
        if (item is! Map) continue;
        final id = _text(item['product_id']);
        final name = _text(item['product_name']);
        if (id.isEmpty || name.isEmpty || found.containsKey(id)) continue;
        found[id] = RecentItem(
          productId: id,
          name: name,
          unit: _text(item['unit']),
          emoji: '🥬',
          quantity: _quantity(item['quantity']),
          requestedAt: millis,
        );
        if (found.length >= 20) return found.values.toList(growable: false);
      }
    }
    return found.values.toList(growable: false);
  }
}
