import 'dart:async';
import 'dart:ui' as ui;
import 'package:share_plus/share_plus.dart';
import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'auth_service.dart';
import 'i18n.dart';
import 'customer_dialog_title.dart';
import 'customer_navigation.dart';
import 'my_orders_page.dart';

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

  // Only render a currently active server-issued handoff code.
  String? codeFor(Map<String, dynamic> order) {
    final status = order['status'] as String? ?? '';
    if (!['assigned', 'picked_up', 'out_for_delivery'].contains(status)) return null;
    final code = order['handoff_code']?.toString();
    if (code == null || !RegExp(r'^[0-9]{6}$').hasMatch(code)) return null;
    return code;
  }

  Future<void> shareForAlternateReceiver(Map<String,dynamic> order) async {
    final code=codeFor(order);
    if(code==null)return;
    final receiver=TextEditingController();
    try {
      final name=await showDialog<String>(context:context,builder:(ctx)=>AlertDialog(
        title:customerDialogTitle(ctx,tr('Share delivery with another receiver','किसी और को डिलीवरी लेने के लिए भेजें')),
        content:Column(mainAxisSize:MainAxisSize.min,children:[
          Text(tr('The person you share with can complete this delivery. Share only with someone you trust.','जिसके पास यह कोड होगा वह डिलीवरी प्राप्त कर सकेगा। केवल भरोसेमंद व्यक्ति से साझा करें।')),
          const SizedBox(height:12),
          TextField(controller:receiver,decoration:InputDecoration(labelText:tr('Receiver name (optional)','प्राप्तकर्ता का नाम (वैकल्पिक)')),maxLength:80),
        ]),
        actions:[
          TextButton(onPressed:()=>Navigator.pop(ctx),child:Text(tr('Cancel','रद्द करें'))),
          FilledButton(onPressed:()=>Navigator.pop(ctx,receiver.text.trim()),child:Text(tr('Share code and QR','कोड और QR भेजें')))
        ],
      ));
      if(name==null||!mounted)return;
      final qr=qrFor(order,code);
      final painter=QrPainter(data:qr,version:QrVersions.auto,gapless:true);
      final image=await painter.toImageData(640,format:ui.ImageByteFormat.png);
      if(image==null)throw Exception('QR image unavailable');
      final message='Easy Mandi order ${order['external_order_id']}\n'
          '${name.isEmpty?'':'Receiver: $name\n'}'
          'Delivery handoff code: $code\n'
          'Please show this QR or code to the delivery partner only after receiving the items.';
      await Share.shareXFiles(
        [XFile.fromData(image.buffer.asUint8List(),mimeType:'image/png')],
        text:message,
        fileNameOverrides:['easymandi-handoff.png'],
      );
    }catch(_){
      if(mounted)ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content:Text(tr('Could not share delivery code. Try again.','डिलीवरी कोड साझा नहीं हुआ। दोबारा प्रयास करें।'))));
    }finally{receiver.dispose();}
  }

  String qrFor(Map<String, dynamic> order, String code) {
    final deliveryId = order['id'];
    final expected = 'easymandi://handoff?delivery=$deliveryId&code=$code';
    final qr = order['handoff_qr'];
    return qr == expected ? qr as String : expected;
  }

  void _languageChanged() {
    if (mounted) setState(() {});
  }

  @override
  void initState() {
    super.initState();
    EasyMandiLanguage.hindi.addListener(_languageChanged);
    refresh();
    timer = Timer.periodic(const Duration(minutes: 1), (_) {
      if (WidgetsBinding.instance.lifecycleState == AppLifecycleState.resumed) {
        refresh(silent: true);
      }
    });
  }

  @override
  void dispose() {
    EasyMandiLanguage.hindi.removeListener(_languageChanged);
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
        bottomNavigationBar: SafeArea(top:false,child:CustomerNavigation(
          active:null,
          onMarket:()=>Navigator.of(context).popUntil((route)=>route.isFirst),
          onOrders:()=>Navigator.of(context).pushReplacement(MaterialPageRoute<void>(
            builder:(_)=>const MyOrdersPage())),
        )),
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
                                    if (codeFor(o) != null) ...[
                                      const SizedBox(height: 12),
                                      Card(
                                        color: const Color(0xFFF2F8F4),
                                        child: Padding(
                                          padding: const EdgeInsets.all(14),
                                          child: Column(
                                            crossAxisAlignment:
                                                CrossAxisAlignment.stretch,
                                            children: [
                                              Text(
                                                tr('Delivery handoff code',
                                                    'डिलीवरी हैंडऑफ कोड'),
                                                style: const TextStyle(
                                                    fontWeight:
                                                        FontWeight.w800),
                                              ),
                                              const SizedBox(height: 10),
                                              Wrap(
                                                spacing: 18,
                                                runSpacing: 14,
                                                crossAxisAlignment:
                                                    WrapCrossAlignment.center,
                                                children: [
                                                  Column(
                                                    crossAxisAlignment:
                                                        CrossAxisAlignment.start,
                                                    children: [
                                                      SelectableText(
                                                        codeFor(o)!,
                                                        style: const TextStyle(
                                                          fontSize: 32,
                                                          fontWeight:
                                                              FontWeight.w900,
                                                          letterSpacing: 5,
                                                        ),
                                                      ),
                                                      const SizedBox(height: 6),
                                                      Text(
                                                        tr(
                                                            'Show this code or QR only after you receive your order.',
                                                            'ऑर्डर मिलने के बाद ही यह कोड या QR डिलीवरी व्यक्ति को दिखाएँ।'),
                                                        style: Theme.of(context)
                                                            .textTheme
                                                            .bodySmall,
                                                      ),
                                                    ],
                                                  ),
                                                  Container(
                                                    color: Colors.white,
                                                    padding:
                                                        const EdgeInsets.all(8),
                                                    child: QrImageView(
                                                      data:
                                                          qrFor(o, codeFor(o)!),
                                                      size: 150,
                                                    ),
                                                  ),
                                                ],
                                              ),
                                              if (codeFor(o) != null) Padding(padding:const EdgeInsets.only(top:12),child:FilledButton.icon(
                                                onPressed:()=>shareForAlternateReceiver(o),icon:const Icon(Icons.share),
                                                label:Text(tr('Share code + QR with receiver','प्राप्तकर्ता को कोड और QR भेजें')))),
                                              if (o['code_expires_at'] != null)
                                                Padding(
                                                  padding:
                                                      const EdgeInsets.only(
                                                          top: 8),
                                                  child: Text(
                                                    tr(
                                                        'Code valid until ${o['code_expires_at']}',
                                                        'कोड ${o['code_expires_at']} तक मान्य है'),
                                                    style: Theme.of(context)
                                                        .textTheme
                                                        .bodySmall,
                                                  ),
                                                ),
                                            ],
                                          ),
                                        ),
                                      ),
                                    ] else if ([
                                      'assigned',
                                      'picked_up',
                                      'out_for_delivery'
                                    ].contains(status))
                                      Text(tr(
                                          'Your handoff code will appear here. Give it to the delivery person only after receiving your order.',
                                          'आपका डिलीवरी कोड यहाँ दिखाई देगा। ऑर्डर मिलने के बाद ही यह कोड डिलीवरी व्यक्ति को दें।')),
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
}
