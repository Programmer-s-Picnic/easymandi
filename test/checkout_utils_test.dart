import 'package:flutter_test/flutter_test.dart';
import 'package:easy_mandi/checkout_utils.dart';
import 'package:easy_mandi/product.dart';
void main() {
 test('WhatsApp accepts formatted Indian number and preserves real newlines', () {
  final uri=whatsappOrderUri('+91 7398 564 033','Order ABC\nItem one\nTotal ₹10.75');
  expect(uri.path,'/917398564033');
  expect(uri.queryParameters['text'],'Order ABC\nItem one\nTotal ₹10.75');
  expect(supportDigits('7398564033'),'917398564033');
 });
 test('Fractional prices and notification identifiers survive mapping', () {
  final product=Product({'id':'onion','name':'Onion','category':'Vegetables','unit':'kg','price':10.75});
  expect(product.price*3,32.25);expect(formatMoney(product.price),'₹10.75');
  expect(notificationId({'id':42,'order_id':7}),42);
 });
}
