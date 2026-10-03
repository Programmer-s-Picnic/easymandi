import 'dart:async';
import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import 'package:url_launcher/url_launcher.dart';
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

  @override void initState() { super.initState(); refresh();timer=Timer.periodic(const Duration(minutes:5),(_){if(WidgetsBinding.instance.lifecycleState==AppLifecycleState.resumed)refresh(silent:true);}); }
  @override void dispose(){timer?.cancel();super.dispose();}
  Future<void> mark({int? id, bool order=false}) async {
    try {if(order){await AuthService.instance.orderNotifications(markAll:id==null,id:id);}
    else {await AuthService.instance.deliveryRequest(orderId:id,markAll:id==null);}
    await refresh(silent:true);}catch(_){if(mounted)ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content:Text('Could not mark notifications. Please retry.')));}
  }
  Future<void> payUpi(Map<String,dynamic> order) async {
    final total=(order['payment_total'] as num?)?.toDouble();
    final ref=order['external_order_id'] as String? ?? '';
    if(total==null||ref.isEmpty)return;
    final uri=Uri(scheme:'upi',host:'pay',queryParameters:{
      'pa':'7398564033@kotakbank','pn':'ABHISHEK KUMAR SINGH',
      'am':total.toStringAsFixed(2),'cu':'INR','tn':'Easy Mandi $ref'
    });
    try{
      final opened=await launchUrl(uri,mode:LaunchMode.externalApplication);
      if(!opened&&mounted)ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content:Text('No UPI app could be opened. Use UPI ID 7398564033@kotakbank.')));
    }catch(_){if(mounted)ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content:Text('Could not open a UPI app. Use UPI ID 7398564033@kotakbank.')));}
  }

  Future<void> uploadReceipt(Map<String,dynamic> order) async {
    final ref=order['external_order_id'] as String? ?? '';
    if(ref.isEmpty)return;
    final picked=await FilePicker.pickFiles(type:FileType.image,withData:true,allowMultiple:false);
    if(picked==null||picked.files.isEmpty)return;
    final file=picked.files.single,bytes=file.bytes;
    if(bytes==null){if(mounted)ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content:Text('Could not read the receipt image.')));return;}
    if(bytes.length>1048576){if(mounted)ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content:Text('Receipt must be smaller than 1 MB.')));return;}
    final ext=(file.extension??file.name.split('.').last).toLowerCase();
    final mime=ext=='png'?'image/png':(ext=='webp'?'image/webp':((ext=='jpg'||ext=='jpeg')?'image/jpeg':''));
    if(mime.isEmpty){if(mounted)ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content:Text('Use a JPG, PNG or WebP receipt.')));return;}
    if(!mounted)return;
    final controller=TextEditingController();
    final reference=await showDialog<String>(context:context,builder:(dialogContext)=>AlertDialog(
      title:const Text('Submit UPI receipt'),
      content:Column(mainAxisSize:MainAxisSize.min,crossAxisAlignment:CrossAxisAlignment.start,children:[
        const Text('The receipt will be stored privately for Easy Mandi admin verification.'),
        const SizedBox(height:12),
        TextField(controller:controller,maxLength:80,decoration:const InputDecoration(labelText:'UPI transaction/reference (optional)')),
      ]),
      actions:[
        TextButton(onPressed:()=>Navigator.pop(dialogContext),child:const Text('Cancel')),
        FilledButton(onPressed:()=>Navigator.pop(dialogContext,controller.text.trim()),child:const Text('Submit receipt')),
      ],
    ));
    controller.dispose();
    if(reference==null)return;
    try{
      await AuthService.instance.submitUpiReceipt(orderId:ref,mimeType:mime,bytes:bytes,upiReference:reference);
      if(mounted)ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content:Text('Receipt submitted for verification.')));
      await refresh(silent:true);
    }on AuthException catch(e){if(mounted)ScaffoldMessenger.of(context).showSnackBar(SnackBar(content:Text(e.message)));}
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
              if(o['payment_method']!=null) Text(
                'Payment: ${(o['payment_method']??'').toString().toUpperCase()} · ${(o['payment_status']??'pending').toString().replaceAll('_',' ')}'
                '${o['payment_total']==null?'':' · ₹${(o['payment_total'] as num).toStringAsFixed(2)}'}',
                style:const TextStyle(fontWeight:FontWeight.w700)),
              if(o['payment_method']=='upi'&&o['payment_status']!='verified') Wrap(spacing:8,runSpacing:8,children:[
                OutlinedButton.icon(onPressed:()=>payUpi(o),icon:const Icon(Icons.account_balance_wallet_outlined),label:const Text('Pay with UPI')),
                FilledButton.tonalIcon(onPressed:()=>uploadReceipt(o),icon:const Icon(Icons.upload_file),label:Text(o['payment_status']=='submitted'?'Replace receipt':'Upload receipt')),
              ]),
              if(o['payment_method']=='upi'&&o['payment_status']=='submitted') const Text('Receipt submitted; waiting for Easy Mandi admin verification.'),
              if(o['payment_method']=='upi'&&o['payment_status']=='rejected') const Text('The previous receipt was not verified. You may submit another receipt.',style:TextStyle(color:Colors.deepOrange)),
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
