import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:easy_mandi/customer_navigation.dart';
import 'package:easy_mandi/customer_dialog_title.dart';
import 'package:easy_mandi/i18n.dart';

void main() {
  testWidgets('Market and My orders remain visible and usable in a compact footer', (tester) async {
    EasyMandiLanguage.hindi.value = false;
    int market = 0;
    int orders = 0;
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: const Text('Products'),
        bottomNavigationBar: CustomerNavigation(
          active: CustomerNavPage.market,
          onMarket: () => market++,
          onOrders: () => orders++,
        ),
      ),
    ));
    expect(find.text('Market'), findsOneWidget);
    expect(find.text('My orders'), findsOneWidget);
    await tester.tap(find.text('My orders'));
    await tester.pump();
    expect(orders, 1);
    await tester.tap(find.text('Market'));
    expect(market, 1);
  });

  testWidgets('Every customer dialog title exposes a dismiss action', (tester) async {
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(body: Builder(
        builder: (context) => TextButton(
          onPressed: () => showDialog<void>(
            context: context,
            builder: (dialogContext) => AlertDialog(
              title: customerDialogTitle(dialogContext, 'Test dialog'),
              content: const Text('Dialog content'),
            ),
          ),
          child: const Text('Open dialog'),
        ),
      )),
    ));
    await tester.tap(find.text('Open dialog'));
    await tester.pumpAndSettle();
    expect(find.text('Dialog content'), findsOneWidget);
    await tester.tap(find.byIcon(Icons.close));
    await tester.pumpAndSettle();
    expect(find.text('Dialog content'), findsNothing);
  });
}
