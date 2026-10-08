import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:easy_mandi/product.dart';
import 'package:easy_mandi/store_gallery.dart';

void main() {
  final onion = Product({'id':'onion','name':'Onion','category':'Vegetables','unit':'1 kg','price':40,'compareAtPrice':55,'emoji':'🧅','available':true});
  final potato = Product({'id':'potato','name':'Potato','category':'Vegetables','unit':'1 kg','price':35,'emoji':'🥔','available':false});

  test('Real comparison prices and secure photo URLs', () {
    expect(onion.savings,15);
    expect(potato.savings,0);
    expect(Product({'id':'x','name':'X','category':'Vegetables','unit':'kg','price':100,'compareAtPrice':80}).savings,0);
    expect(Product({'id':'y','name':'Y','category':'Vegetables','unit':'kg','price':40,'imageUrl':'http://example.com/img.jpg'}).imageUrl,'');
  });

  testWidgets('Category, favorite and Add controls are usable', (tester) async {
    final changes=<int>[],categories=<String>[],favorites=<String>[];
    await tester.pumpWidget(MaterialApp(home:Scaffold(body:SizedBox(height:600,width:400,child:StoreGallery(
      products:[onion,potato],
      categories:const ['All','Vegetables','Essentials'],
      selectedCategory:'All',quantities:const {},favorites:const {},
      onCategorySelected:categories.add,onProductTap:(_){},
      onQuantityChanged:(_,delta)=>changes.add(delta),
      onFavoriteTap:(p)=>favorites.add(p.id),
    )))));
    expect(find.text('₹40'),findsOneWidget);
    expect(find.text('₹55'),findsOneWidget);
    expect(find.text('Save ₹15'),findsOneWidget);
    expect(find.text('Sold out'),findsOneWidget);
    await tester.tap(find.text('ADD'));
    expect(changes,[1]);
    await tester.tap(find.byIcon(Icons.favorite_border).first);
    expect(favorites,['onion']);
    await tester.tap(find.text('Vegetables'));
    expect(categories,['Vegetables']);
  });
}
