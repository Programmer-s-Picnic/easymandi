import 'package:flutter_test/flutter_test.dart';
import 'package:easy_mandi/recent_order_items.dart';

void main() {
  test('Aggregated customer data creates visible previously ordered products', () {
    final items=RecentOrderItems.fromCustomerData([
      {'product_id':'tomato','name':'Tomatoes','unit':'1 kg','quantity':'3','last_ordered':'2026-10-09 08:21:00'},
      {'product_id':'potato','name':'Potatoes','unit':'500 g','quantity':2},
      {'product_id':'tomato','name':'Tomatoes','unit':'1 kg','quantity':1},
    ]);
    expect(items.length,2);
    expect(items.first.productId,'tomato');
    expect(items.first.quantity,3);
    expect(items.last.unit,'500 g');
  });

  test('Order history fallback includes unassigned order items', () {
    final items=RecentOrderItems.fromOrderHistory([
      {'status':'New','created_at':'2026-10-09T08:11:00+05:30','delivery_status':null,'items':[
        {'product_id':'onion','product_name':'Onions','unit':'1 kg','quantity':2},
        {'product_id':'potato','product_name':'Potatoes','unit':'1 kg','quantity':'1'},
      ]},
      {'status':'Delivered','created_at':'2026-10-08T08:11:00+05:30','items':[
        {'product_id':'onion','product_name':'Onions','unit':'1 kg','quantity':4},
        {'product_id':'okra','product_name':'Okra','unit':'250 g','quantity':3},
      ]},
    ]);
    expect(items.map((e)=>e.productId).toList(),['onion','potato','okra']);
    expect(items.first.quantity,2);
    expect(items.first.requestedAt,greaterThan(0));
  });

  test('Cancelled, malformed and empty orders are handled safely', () {
    expect(RecentOrderItems.fromCustomerData(null),isEmpty);
    expect(RecentOrderItems.fromOrderHistory([]),isEmpty);
    final items=RecentOrderItems.fromOrderHistory([
      {'status':'Cancelled','items':[{'product_id':'onion','product_name':'Onions','quantity':1}]},
      {'status':'New','items':[{'product_id':'','product_name':'Bad row'},{'product_id':'carrot','product_name':'Carrot','quantity':'2'}]},
    ]);
    expect(items.length,1);
    expect(items.single.productId,'carrot');
    expect(items.single.quantity,2);
  });
}
