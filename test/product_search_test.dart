import 'package:flutter_test/flutter_test.dart';
import 'package:easy_mandi/product.dart';

void main() {
  Product product(Map<String,dynamic> values) => Product({
    'id':'bhindi','name':'Lady Finger','hindi':'भिंडी','category':'Vegetables',
    'unit':'1 kg','price':40,'description':'','emoji':'🥬','available':true,
    ...values,
  });

  test('alternative product names work in English and Hindi', () {
    final p=product({'searchKeywords':['bhindi','lady finger','okra','भिंडी']});
    expect(p.searchRank('OKRA'), 1);
    expect(p.searchRank('ladyfinger'), 0);
    expect(p.searchRank('bhindi'), 1);
    expect(p.searchRank('भिंडी'), 0);
    expect(p.searchRank('bhin'), 3);
    expect(p.searchRank('karela'), isNull);
  });

  test('catalog without searchKeywords remains searchable', () {
    final p=product({});
    expect(p.searchKeywords, isEmpty);
    expect(p.searchRank('lady'), 2);
    expect(p.searchRank('veg'), 6);
    expect(p.searchRank('okra'), isNull);
  });
}
