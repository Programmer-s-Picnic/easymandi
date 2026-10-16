import 'package:flutter/material.dart';
import 'i18n.dart';

/// 4-hour order target in IST; order timestamps may arrive as MySQL dates.
DateTime? easyMandiOrderTime(dynamic raw) {
  if (raw == null) return null;
  if (raw is DateTime) return raw;
  var text = raw.toString().trim();
  if (text.isEmpty) return null;
  if (RegExp(r'^\d{4}-\d\d-\d\d[ T]\d\d:\d\d').hasMatch(text) &&
      !RegExp(r'(?:Z|[+-]\d\d:?\d\d)$', caseSensitive: false).hasMatch(text)) {
    text = text.replaceFirst(' ', 'T') + '+05:30';
  }
  return DateTime.tryParse(text);
}

String easyMandiClockIst(DateTime date) {
  final ist = date.toUtc().add(const Duration(hours: 5, minutes: 30));
  String two(int n) => n.toString().padLeft(2, '0');
  return '${two(ist.hour)}:${two(ist.minute)}';
}

String easyMandiDeliveryWindowText(dynamic placedAt) {
  final placed = easyMandiOrderTime(placedAt);
  if (placed == null) return tr(
    'Your order will be delivered within 4 working hours. Keep ordering with Easy Mandi and save on MANDI rate.',
    'आपका ऑर्डर 4 कार्य घंटों के भीतर डिलीवर किया जाएगा। Easy Mandi से ऑर्डर करते रहें और MANDI रेट पर बचत करें।');
  final latest = placed.add(const Duration(hours: 4));
  return tr(
    'Order Time: ${easyMandiClockIst(placed)} · Max Order Delivery Time: ${easyMandiClockIst(latest)} IST.\n'
    'Your order will be delivered within 4 working hours. Keep ordering with Easy Mandi and save on MANDI rate.',
    'ऑर्डर समय: ${easyMandiClockIst(placed)} · अधिकतम डिलीवरी समय: ${easyMandiClockIst(latest)} IST।\n'
    'आपका ऑर्डर 4 कार्य घंटों के भीतर डिलीवर किया जाएगा। Easy Mandi से ऑर्डर करते रहें और MANDI रेट पर बचत करें.',
  );
}

Widget easyMandiDeliveryWindowBanner([dynamic placedAt]) => Container(
  margin: const EdgeInsets.symmetric(vertical: 7),
  padding: const EdgeInsets.all(11),
  decoration: BoxDecoration(
    color: const Color(0xFFEFF8FE),
    border: Border.all(color: const Color(0xFFB9D9EB)),
    borderRadius: BorderRadius.circular(10),
  ),
  child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
    const Icon(Icons.local_shipping_outlined, color: Color(0xFF17618A), size: 19),
    const SizedBox(width: 8),
    Expanded(child: Text(easyMandiDeliveryWindowText(placedAt),
      style: const TextStyle(fontSize: 12.5, height: 1.5, fontWeight: FontWeight.w600,
        color: Color(0xFF204E6C)))),
  ]),
);
