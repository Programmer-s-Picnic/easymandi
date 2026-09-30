String supportDigits(String phone) {
  final digits = phone.replaceAll(RegExp(r'[^0-9]'), '');
  return digits.length == 10 ? '91$digits' : digits;
}
String formatMoney(num amount) => '₹${amount.toStringAsFixed(2)}';
Uri whatsappOrderUri(String phone, String message) => Uri.https(
  'wa.me', '/${supportDigits(phone)}', {'text': message});
int notificationId(Map<String, dynamic> notification) =>
  (notification['id'] as num).toInt();
