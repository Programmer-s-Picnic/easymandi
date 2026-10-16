import 'package:flutter/material.dart';
import 'i18n.dart';

/// Easy Mandi 07:00-23:00 IST checkout cutoff, including 07:00, excluding 23:00.
bool easyMandiCheckoutOpen([DateTime? at]){
  final local=(at??DateTime.now()).toUtc().add(const Duration(hours:5,minutes:30));
  return local.hour>=7&&local.hour<23;
}
/// Delivery Policy V2: use recorded confirmation, carrying service minutes overnight.
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

DateTime? easyMandiAttemptTarget(dynamic value){
  final confirmed=easyMandiOrderTime(value);
  if(confirmed==null)return null;
  const offset=Duration(hours:5,minutes:30);
  var local=confirmed.toUtc().add(offset);
  var start=DateTime.utc(local.year,local.month,local.day,7);
  final close=DateTime.utc(local.year,local.month,local.day,23);
  if(local.isBefore(start))local=start;
  else if(!local.isBefore(close)){
    start=start.add(const Duration(days:1));
    local=start;
  }
  final end=DateTime.utc(local.year,local.month,local.day,23);
  final remaining=end.difference(local);
  final due=remaining>=const Duration(minutes:60)
    ?local.add(const Duration(minutes:60))
    :DateTime.utc(local.year,local.month,local.day+1,7)
       .add(const Duration(minutes:60)).subtract(remaining);
  return due.subtract(offset);
}
String easyMandiDeliveryWindowText(dynamic confirmedAt,{dynamic placedAt,dynamic targetAt}){
  final confirmed=easyMandiOrderTime(confirmedAt),placed=easyMandiOrderTime(placedAt);
  const english='Delivery attempted within 60 service minutes after confirmation (7 AM–11 PM IST). Rush-hour, traffic or high-demand delays are possible. Keep ordering with Easy Mandi and save at MANDI rates.';
  const hindi='पुष्टि के बाद 60 कार्य मिनट में डिलीवरी का प्रयास (सुबह 7 से रात 11 बजे तक)। ट्रैफिक या अधिक ऑर्डर के कारण देरी हो सकती है। मंडी भाव पर बचत के लिए ऑर्डर करते रहें।';
  if(confirmed==null){
    return (placed==null?'':'${tr('Order time','ऑर्डर समय')}: ${easyMandiClockIst(placed)} IST · ')+
      tr('Awaiting order confirmation. ','ऑर्डर की पुष्टि बाकी है। ')+tr(english,hindi);
  }
  final target=easyMandiOrderTime(targetAt)??easyMandiAttemptTarget(confirmed)!;
  final a=confirmed.toUtc().add(const Duration(hours:5,minutes:30));
  final b=target.toUtc().add(const Duration(hours:5,minutes:30));
  final next=(a.day!=b.day || a.month!=b.month || a.year!=b.year);
  final nextDay=next?' (${b.day}/${b.month})':'';
  return '${tr('Confirmed','पुष्टि')}: ${easyMandiClockIst(confirmed)} IST · '
    '${tr('Delivery attempt target','डिलीवरी प्रयास लक्ष्य')}: ${easyMandiClockIst(target)}$nextDay IST.\n'
    '${tr(english,hindi)}';
}

Widget easyMandiDeliveryWindowBanner([dynamic confirmedAt,{dynamic placedAt,dynamic targetAt}]) => Container(
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
    Expanded(child: Text(easyMandiDeliveryWindowText(confirmedAt,placedAt:placedAt,targetAt:targetAt),
      style: const TextStyle(fontSize: 12.5, height: 1.5, fontWeight: FontWeight.w600,
        color: Color(0xFF204E6C)))),
  ]),
);
