import 'package:flutter/material.dart';
import 'i18n.dart';

enum CustomerNavPage { market, orders }

/// Persistent navigation shared by the storefront and customer order history.
/// The market can be browsed without login; the caller handles sign-in for orders.
class CustomerNavigation extends StatelessWidget {
  const CustomerNavigation({
    super.key,
    required this.active,
    required this.onMarket,
    required this.onOrders,
  });

  final CustomerNavPage? active;
  final VoidCallback onMarket;
  final VoidCallback onOrders;

  @override
  Widget build(BuildContext context) {
    Widget link({
      required IconData icon,
      required String label,
      required bool selected,
      required VoidCallback onPressed,
    }) {
      final color = selected ? const Color(0xFF176B46) : const Color(0xFF364940);
      return Expanded(
        child: Semantics(
          selected: selected,
          button: true,
          child: OutlinedButton.icon(
            onPressed: onPressed,
            icon: Icon(icon, size: 19),
            label: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis),
            style: OutlinedButton.styleFrom(
              foregroundColor: color,
              backgroundColor: selected ? const Color(0xFFE2F2E8) : Colors.white,
              side: BorderSide(color: selected ? const Color(0xFF176B46) : const Color(0xFFC8DED0)),
              padding: const EdgeInsets.symmetric(horizontal: 7),
              minimumSize: const Size(0, 44),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              textStyle: const TextStyle(fontWeight: FontWeight.w800, fontSize: 12),
            ),
          ),
        ),
      );
    }

    return Container(
      color: const Color(0xFFF7FAF7),
      padding: const EdgeInsets.fromLTRB(12, 7, 12, 7),
      child: Row(
        children: [
          link(
            icon: Icons.storefront_outlined,
            label: tr('Market', 'मंडी'),
            selected: active == CustomerNavPage.market,
            onPressed: onMarket,
          ),
          const SizedBox(width: 10),
          link(
            icon: Icons.receipt_long_outlined,
            label: tr('My orders', 'मेरे ऑर्डर'),
            selected: active == CustomerNavPage.orders,
            onPressed: onOrders,
          ),
        ],
      ),
    );
  }
}
