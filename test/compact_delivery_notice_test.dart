import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:easy_mandi/delivery_window.dart';
import 'package:easy_mandi/i18n.dart';
import 'package:easy_mandi/product.dart';
import 'package:easy_mandi/store_gallery.dart';

void main(){
  testWidgets('V3 delivery notice starts full, compacts, expands, dismisses and translates', (tester) async {
    EasyMandiLanguage.hindi.value=false;
    var mode=CatalogDeliveryMode.expanded;
    var policies=0;
    await tester.pumpWidget(MaterialApp(home:Scaffold(body:StatefulBuilder(builder:(context,setState)=>
      CatalogDeliveryNotice(mode:mode,
        onToggle:()=>setState(()=>mode=mode==CatalogDeliveryMode.expanded
            ?CatalogDeliveryMode.compact:CatalogDeliveryMode.expanded),
        onDismiss:()=>setState(()=>mode=CatalogDeliveryMode.dismissed),
        onPolicyTap:()=>policies++,
      )))));
    expect(find.text('Your delivery window'),findsOneWidget);
    await tester.tap(find.text('View full policy'));
    expect(policies,1);
    await tester.tap(find.byTooltip('Minimise delivery notice'));
    await tester.pump();
    expect(find.textContaining('60-min delivery attempt'),findsOneWidget);
    expect(find.text('Your delivery window'),findsNothing);
    await tester.tap(find.byTooltip('Expand delivery notice'));
    await tester.pump();
    expect(find.text('Your delivery window'),findsOneWidget);
    await tester.tap(find.byTooltip('Close delivery notice'));
    await tester.pump();
    expect(find.byType(CatalogDeliveryNotice),findsOneWidget);
    expect(find.text('Your delivery window'),findsNothing);
    expect(tester.takeException(),isNull);
  });
  testWidgets('Compact text translates to Hindi without changing service hours', (tester) async {
    EasyMandiLanguage.hindi.value=true;
    await tester.pumpWidget(MaterialApp(home:Scaffold(body:CatalogDeliveryNotice(
      mode:CatalogDeliveryMode.compact,onToggle:(){},onDismiss:(){},onPolicyTap:(){}))));
    expect(find.textContaining('60 मिनट'),findsOneWidget);
    expect(tester.takeException(),isNull);
    EasyMandiLanguage.hindi.value=false;
  });
  testWidgets('Scrolling product gallery notifies the parent for auto-minimisation', (tester) async {
    EasyMandiLanguage.hindi.value=false;
    final product=Product({'id':'onion','name':'Onion','category':'Vegetables',
       'unit':'1 kg','price':40,'emoji':'🧅','available':true});
    final offsets=<double>[];
    await tester.pumpWidget(MaterialApp(home:Scaffold(body:SizedBox(height:430,
      child:StoreGallery(products:List.generate(35,(i)=>product),
       categories:const ['All','Vegetables'],selectedCategory:'All',
       quantities:const {},favorites:const {},onCategorySelected:(_){},
       onProductTap:(_){},onQuantityChanged:(_,__) {},onFavoriteTap:(_){},
       onCatalogScroll:offsets.add)))));
    await tester.drag(find.byType(CustomScrollView),const Offset(0,-300));
    await tester.pump();
    expect(offsets.any((o)=>o>24),true);
  });
}
