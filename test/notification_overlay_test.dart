import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:easy_mandi/i18n.dart';
import 'package:easy_mandi/notification_overlay.dart';

void main() {
  testWidgets('Notifications open from My Account without a persistent screen overlay',
      (tester) async {
    final marked = <Map<String, dynamic>?>[];
    EasyMandiLanguage.hindi.value = false;
    notificationFeed.value = [
      {'id': 42, 'order_id': 7, 'message': 'Delivery update', 'read_at': null}
    ];
    notificationMark = (record) async { marked.add(record); };
    addTearDown(() {
      notificationFeed.value = [];
      notificationMark = null;
      EasyMandiLanguage.hindi.value = false;
    });

    await tester.pumpWidget(MaterialApp(
      navigatorKey: notificationNavigator,
      builder: notificationOverlay,
      home: const Scaffold(body: Text('Original screen')),
    ));

    // The storefront must remain unobstructed, even with unread notifications.
    expect(find.text('Original screen'), findsOneWidget);
    expect(find.text('Delivery update'), findsNothing);
    expect(find.text('Notifications'), findsNothing);

    // My Account opens the notification history using this function.
    final dialogResult = showNotificationModal();
    await tester.pumpAndSettle();
    expect(find.text('Notifications'), findsOneWidget);
    expect(find.text('Delivery update'), findsOneWidget);

    await tester.tap(find.byTooltip('Mark as read'));
    await tester.pump();
    expect(marked.single?['id'], 42);
    expect(marked.single?['order_id'], 7);

    await tester.tap(find.text('Mark all as read'));
    await tester.pump();
    expect(marked.length, 2);
    expect(marked.last, isNull);

    await tester.tap(find.text('Close'));
    await tester.pumpAndSettle();
    await dialogResult;
    expect(find.text('Delivery update'), findsNothing);
    expect(find.text('Original screen'), findsOneWidget);
  });
}
