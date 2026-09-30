import 'dart:async';
import 'package:flutter/material.dart';
import 'auth_service.dart';

class DeliveryPage extends StatefulWidget {
  const DeliveryPage({super.key});
  @override State<DeliveryPage> createState() => _DeliveryPageState();
}

class _DeliveryPageState extends State<DeliveryPage> {
  List<dynamic> orders = [], notifications = [];
  List<dynamic> orderUpdates=[];
  Timer? timer;
  bool loading=false;
  int get unread => [...notifications,...orderUpdates].where((n)=>n['read_at']==null).length;
  bool busy = true;
  String? error;

  @override void initState() { super.initState(); refresh();timer=Timer.periodic(const Duration(seconds:30),(_){if(WidgetsBinding.instance.lifecycleState==AppLifecycleState.resumed)refresh(silent:true);}); }
  @override void dispose(){timer?.cancel();super.dispose();}
  Future<void> mark({int? id, bool order=false}) async {
    try {if(order){await AuthService.instance.orderNotifications(markAll:id==null,id:id);}
    else {await AuthService.instance.deliveryRequest(orderId:id,markAll:id==null);}
    await refresh(silent:true);}catch(_){if(mounted)ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content:Text('Could not mark notifications. Please retry.')));}
  }
  Future<void> refresh({bool silent=false}) async {
    if(loading)return;loading=true;
    if(!silent)setState(() { busy = true; error = null; });
    try {
      final data = await AuthService.instance.deliveryRequest();
      final updates=await AuthService.instance.orderNotifications();
      if (mounted) setState(() { orderUpdates=updates['notifications'] as List<dynamic>? ?? []; orders = data['orders'] as List<dynamic>? ?? []; notifications = data['notifications'] as List<dynamic>? ?? []; });
    } on AuthException catch (e) {
      if (mounted) setState(() => error = e.message);
    } catch (_) {
      if (mounted) setState(() => error = 'Could not load deliveries.');
    } finally {
      loading=false;
      if (mounted) setState(() => busy = false);
    }
  }
  @override Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text('Deliveries · $unread unread'), actions: [
      IconButton(onPressed: () => refresh(), icon: const Icon(Icons.refresh), tooltip: 'Refresh')
    ]),
    body: busy ? const Center(child: CircularProgressIndicator()) :
      error != null ? Center(child: Text(error!)) :
      RefreshIndicator(onRefresh: () => refresh(), child: ListView(padding: const EdgeInsets.all(16), children: [
        if (orders.isEmpty) const ListTile(title: Text('No deliveries yet'), subtitle: Text('Your assigned Easy Mandi orders will appear here.')),
        for (final raw in orders) Builder(builder: (context) {
          final o = raw as Map<String,dynamic>;
          final status = o['status'] as String? ?? '';
          return Card(child: Padding(padding: const EdgeInsets.all(16), child:
            Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Order ${o['external_order_id']}', style: Theme.of(context).textTheme.titleMedium),
              Text('Status: $status'),
              Text(o['address_text'] as String? ?? ''),
              if (['assigned','picked_up','out_for_delivery'].contains(status))
                const Text('The admin will send your handoff code. Give it to the delivery person only after receiving your order.'),
            ])));
        }),
        if(orderUpdates.isNotEmpty)...[
          Text('Order notifications',style:Theme.of(context).textTheme.titleLarge),
          TextButton(onPressed:()=>mark(order:true),child:const Text('Mark order notifications as read')),
          for(final raw in orderUpdates) ListTile(
            leading:Icon(raw['read_at']==null?Icons.notifications_active:Icons.notifications_none),
            title:Text(raw['message'] as String? ?? 'Order update'),subtitle:Text(raw['created_at'] as String? ?? ''),
            onTap:()=>mark(id:(raw['id'] as num).toInt(),order:true)),
        ],
        if (notifications.isNotEmpty) ...[
          const SizedBox(height: 16),
          TextButton(onPressed:()=>mark(),child:const Text('Mark delivery notifications as read')),
          Text('Delivery notifications', style: Theme.of(context).textTheme.titleLarge),
          for (final raw in notifications) ListTile(leading:Icon(raw['read_at']==null?Icons.notifications_active:Icons.notifications_none),onTap:()=>mark(id:(raw['id'] as num).toInt()),title: Text((raw as Map<String,dynamic>)['message'] as String? ?? 'Update'),
            subtitle: Text(raw['created_at'] as String? ?? '')),
        ]
      ])),
  );
}
