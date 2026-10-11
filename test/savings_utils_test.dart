import 'package:flutter_test/flutter_test.dart';
import 'package:easy_mandi/savings_utils.dart';

void main() {
  test('only real positive savings are displayed', () {
    expect(positiveSavings(85.25), 85.25);
    expect(positiveSavings('15.50'), 15.50);
    expect(positiveSavings(null), 0);
    expect(positiveSavings(-15), 0);
    expect(positiveSavings(double.nan), 0);
    expect(positiveSavings('unknown'), 0);
  });
  test('PIN is optional, but complete if entered', () {
    expect(validOptionalPin(''), isTrue);
    expect(validOptionalPin('  '), isTrue);
    expect(validOptionalPin('221005'), isTrue);
    expect(validOptionalPin('021005'), isFalse);
    expect(validOptionalPin('221'), isFalse);
    expect(validOptionalPin('2210051'), isFalse);
  });
}
