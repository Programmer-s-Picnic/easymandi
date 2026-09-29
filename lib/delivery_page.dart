import 'package:flutter/material.dart';
import 'auth_service.dart';

class DeliveryPage extends StatefulWidget {
  const DeliveryPage({super.key});
  @override State<DeliveryPage> createState() => _DeliveryPageState();
}

class _DeliveryPageState extends State<DeliveryPage> {
  List<dynamic> orders = [], notifications = [];
  bool busy = true;
  String? error;
  final Map<int,String> codes = {};

  @override void initState() { super.initState(); refresh(); }
  Future<void> refresh() async {
    setState(() { busy = true; error = null; });
    try {
      final data = await AuthService.instance.deliveryRequest();
      if (mounted) setState(() { orders = data['orders'] as List<dynamic>? ?? []; notifications = data['notifications'] as List<dynamic>? ?? []; });
    } on AuthException catch (e) {
      if (mounted) setState(() => error = e.message);
    } catch (_) {
      if (mounted) setState(() => error = 'Could not load deliveries.');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }
  Future<void> issue(int id) async {
    try {
      final data = await AuthService.instance.deliveryRequest(orderId: id);
      if (mounted) setState(() => codes[id] = data['code'] as String);
      await refresh();
    } on AuthException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }
  @override Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('My deliveries'), actions: [
      IconButton(onPressed: refresh, icon: const Icon(Icons.refresh), tooltip: 'Refresh')
    ]),
    body: busy ? const Center(child: CircularProgressIndicator()) :
      error != null ? Center(child: Text(error!)) :
      RefreshIndicator(onRefresh: refresh, child: ListView(padding: const EdgeInsets.all(16), children: [
        if (orders.isEmpty) const ListTile(title: Text('No deliveries yet'), subtitle: Text('Your assigned Easy Mandi orders will appear here.')),
        for (final raw in orders) Builder(builder: (context) {
          final o = raw as Map<String,dynamic>;
          final id = (o['id'] as num).toInt();
          final status = o['status'] as String? ?? '';
          return Card(child: Padding(padding: const EdgeInsets.all(16), child:
            Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Order ${o['external_order_id']}', style: Theme.of(context).textTheme.titleMedium),
              Text('Status: $status'),
              Text(o['address_text'] as String? ?? ''),
              if (codes[id] != null) SelectableText('Handoff code: ${codes[id]}',
                style: Theme.of(context).textTheme.headlineSmall),
              if (['assigned','picked_up','out_for_delivery'].contains(status))
                FilledButton(onPressed: () => issue(id), child: const Text('Get handoff code')),
              const Text('Give the code only after receiving your order. A new code invalidates the previous one.'),
            ])));
        }),
        if (notifications.isNotEmpty) ...[
          const SizedBox(height: 16),
          Text('Updates', style: Theme.of(context).textTheme.titleLarge),
          for (final raw in notifications) ListTile(title: Text((raw as Map<String,dynamic>)['message'] as String? ?? 'Update'),
            subtitle: Text(raw['created_at'] as String? ?? '')),
        ]
      ])),
  );
}
