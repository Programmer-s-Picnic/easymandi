import 'dart:async';
import 'package:flutter/material.dart';
import 'auth_service.dart';
import 'i18n.dart';

class DeliveryPage extends StatefulWidget {
  const DeliveryPage({super.key});
  @override
  State<DeliveryPage> createState() => _DeliveryPageState();
}

class _DeliveryPageState extends State<DeliveryPage> {
  List<dynamic> orders = [], notifications = [];
  List<dynamic> orderUpdates = [];
  Timer? timer;
  bool loading = false;
  int get unread =>
      [...notifications, ...orderUpdates].where((n) => n['read_at'] == null).length;
  bool busy = true;
  String? error;

  @override
  void initState() {
    super.initState();
    refresh();
    timer = Timer.periodic(const Duration(minutes: 5), (_) {
      if (WidgetsBinding.instance.lifecycleState == AppLifecycleState.resumed) {
        refresh(silent: true);
      }
    });
  }

  @override
  void dispose() {
    timer?.cancel();
    super.dispose();
  }

  Future<void> mark({int? id, bool order = false}) async {
    try {
      if (order) {
        await AuthService.instance.orderNotifications(markAll: id == null, id: id);
      } else {
        await AuthService.instance.deliveryRequest(orderId: id, markAll: id == null);
      }
      await refresh(silent: true);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text(tr(
                'Could not mark notifications. Please retry.',
                'सूचनाएँ पढ़ी हुई चिन्हित नहीं हो सकीं। कृपया फिर प्रयास करें।'))));
      }
    }
  }

  Future<void> refresh({bool silent = false}) async {
    if (loading) return;
    loading = true;
    if (!silent) setState(() { busy = true; error = null; });
    try {
      final data = await AuthService.instance.deliveryRequest();
      final updates = await AuthService.instance.orderNotifications();
      if (mounted) {
        setState(() {
          orderUpdates = updates['notifications'] as List<dynamic>? ?? [];
          orders = data['orders'] as List<dynamic>? ?? [];
          notifications = data['notifications'] as List<dynamic>? ?? [];
        });
      }
    } on AuthException catch (e) {
      if (mounted) setState(() => error = localizeError(e.message));
    } catch (_) {
      if (mounted) {
        setState(() => error =
            tr('Could not load deliveries.', 'डिलीवरी लोड नहीं हो सकीं।'));
      }
    } finally {
      loading = false;
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(
          title: Text(tr('Deliveries · $unread unread',
              'डिलीवरी · $unread अपठित')),
          actions: [
            const LanguageButton(),
            IconButton(
              onPressed: () => refresh(),
              icon: const Icon(Icons.refresh),
              tooltip: tr('Refresh', 'रीफ़्रेश'),
            )
          ],
        ),
        body: busy
            ? const Center(child: CircularProgressIndicator())
            : error != null
                ? Center(child: Text(error!))
                : RefreshIndicator(
                    onRefresh: () => refresh(),
                    child: ListView(
                      padding: const EdgeInsets.all(16),
                      children: [
                        if (orders.isEmpty)
                          ListTile(
                            title: Text(tr(
                                'No deliveries yet', 'अभी कोई डिलीवरी नहीं')),
                            subtitle: Text(tr(
                                'Your assigned Easy Mandi orders will appear here.',
                                'आपके Easy Mandi ऑर्डर की डिलीवरी यहाँ दिखाई देगी।')),
                          ),
                        for (final raw in orders)
                          Builder(builder: (context) {
                            final o = raw as Map<String, dynamic>;
                            final status = o['status'] as String? ?? '';
                            return Card(
                              child: Padding(
                                padding: const EdgeInsets.all(16),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      tr('Order ${o['external_order_id']}',
                                          'ऑर्डर ${o['external_order_id']}'),
                                      style: Theme.of(context)
                                          .textTheme
                                          .titleMedium,
                                    ),
                                    Text(tr('Status: ${statusText(status)}',
                                        'स्थिति: ${statusText(status)}')),
                                    Text(o['address_text'] as String? ?? ''),
                                    if ([
                                      'assigned',
                                      'picked_up',
                                      'out_for_delivery'
                                    ].contains(status))
                                      Text(tr(
                                          'The admin will send your handoff code. Give it to the delivery person only after receiving your order.',
                                          'एडमिन आपको डिलीवरी कोड भेजेगा। ऑर्डर मिलने के बाद ही यह कोड डिलीवरी व्यक्ति को दें।')),
                                  ],
                                ),
                              ),
                            );
                          }),
                        if (orderUpdates.isNotEmpty) ...[
                          Text(
                            tr('Order notifications', 'ऑर्डर सूचनाएँ'),
                            style: Theme.of(context).textTheme.titleLarge,
                          ),
                          TextButton(
                            onPressed: () => mark(order: true),
                            child: Text(tr(
                                'Mark order notifications as read',
                                'ऑर्डर सूचनाएँ पढ़ी हुई चिन्हित करें')),
                          ),
                          for (final raw in orderUpdates)
                            ListTile(
                              leading: Icon(raw['read_at'] == null
                                  ? Icons.notifications_active
                                  : Icons.notifications_none),
                              title: Text(raw['message'] as String? ??
                                  tr('Order update', 'ऑर्डर अपडेट')),
                              subtitle: Text(raw['created_at'] as String? ?? ''),
                              onTap: () => mark(
                                  id: (raw['id'] as num).toInt(), order: true),
                            ),
                        ],
                        if (notifications.isNotEmpty) ...[
                          const SizedBox(height: 16),
                          TextButton(
                            onPressed: () => mark(),
                            child: Text(tr(
                                'Mark delivery notifications as read',
                                'डिलीवरी सूचनाएँ पढ़ी हुई चिन्हित करें')),
                          ),
                          Text(
                            tr('Delivery notifications', 'डिलीवरी सूचनाएँ'),
                            style: Theme.of(context).textTheme.titleLarge,
                          ),
                          for (final raw in notifications)
                            ListTile(
                              leading: Icon(raw['read_at'] == null
                                  ? Icons.notifications_active
                                  : Icons.notifications_none),
                              onTap: () => mark(id: (raw['id'] as num).toInt()),
                              title: Text((raw as Map<String, dynamic>)['message']
                                      as String? ??
                                  tr('Update', 'अपडेट')),
                              subtitle: Text(raw['created_at'] as String? ?? ''),
                            ),
                        ]
                      ],
                    ),
                  ),
      );
