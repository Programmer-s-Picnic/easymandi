import 'dart:async';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:share_plus/share_plus.dart';
import 'auth_service.dart';
import 'i18n.dart';
import 'customer_navigation.dart';
import 'customer_dialog_title.dart';

class MyOrdersPage extends StatefulWidget {
  const MyOrdersPage({super.key});
  @override State<MyOrdersPage> createState()=>_MyOrdersPageState();
}
class _MyOrdersPageState extends State<MyOrdersPage> {
  final List<Map<String,dynamic>> orders=[];
  bool loading=false,hasMore=false;
  int page=0;
  String? error,deliveryError;
  final Map<String,Map<String,dynamic>> deliveries={};
  List<dynamic> orderUpdates=[],deliveryUpdates=[];
  Timer? timer;

  String money(dynamic n)=>'₹${(num.tryParse('$n')??0).toStringAsFixed(2)}';
  String ist(dynamic text){
    if(text==null||text=='')return '—';
    final parsed=DateTime.tryParse('$text');
    if(parsed==null)return '$text IST';
    final date=parsed.toUtc().add(const Duration(hours:5,minutes:30));
    String two(int n)=>n.toString().padLeft(2,'0');
    return '${two(date.day)}/${two(date.month)}/${date.year} ${two(date.hour)}:${two(date.minute)} IST';
  }

  @override void initState(){
    super.initState();
    EasyMandiLanguage.hindi.addListener(languageChanged);
    load();
    timer=Timer.periodic(const Duration(minutes:1),(_){
      if(mounted&&WidgetsBinding.instance.lifecycleState==AppLifecycleState.resumed&&!loading){
        refreshLive();
      }
    });
  }
  void languageChanged(){if(mounted)setState((){});}
  @override void dispose(){
    timer?.cancel();
    EasyMandiLanguage.hindi.removeListener(languageChanged);
    super.dispose();
  }
  Future<void> refresh()async{
    if(loading)return;
    setState((){orders.clear();page=0;hasMore=false;error=null;deliveryError=null;deliveries.clear();});
    await load();
  }
  Future<void> load()async{
    if(loading)return;
    setState(()=>loading=true);
    try{
      final result=await AuthService.instance.myOrders(page:page+1);
      if(page==0)await fetchDeliveryAndUpdates();
      if(!mounted)return;
      final list=(result['orders'] as List<dynamic>? ?? [])
          .whereType<Map<String,dynamic>>().toList();
      setState((){orders.addAll(list);page++;hasMore=result['hasMore']==true;error=null;});
    }on AuthException catch(e){if(mounted)setState(()=>error=localizeError(e.message));}
    catch(_){if(mounted)setState(()=>error=tr('Orders could not be loaded.','ऑर्डर लोड नहीं हुए।'));}
    finally{if(mounted)setState(()=>loading=false);}
  }

  Future<void> fetchDeliveryAndUpdates() async {
    try {
      final results=await Future.wait([
        AuthService.instance.deliveryRequest(),
        AuthService.instance.orderNotifications(),
      ]);
      if(!mounted)return;
      final byRef=<String,Map<String,dynamic>>{};
      for(final raw in (results[0]['orders'] as List<dynamic>? ?? [])){
        if(raw is Map<String,dynamic> && raw['external_order_id']!=null){
          byRef[raw['external_order_id'].toString()]=raw;
        }
      }
      setState((){
        deliveries..clear()..addAll(byRef);
        deliveryUpdates=results[0]['notifications'] as List<dynamic>? ?? [];
        orderUpdates=results[1]['notifications'] as List<dynamic>? ?? [];
        deliveryError=null;
      });
    }catch(_){
      if(mounted)setState(()=>deliveryError=tr('Delivery updates are unavailable. Pull down to retry.',
        'डिलीवरी जानकारी उपलब्ध नहीं है। दोबारा प्रयास के लिए नीचे खींचें।'));
    }
  }
  Future<void> refreshLive() async {
    if(!mounted||loading)return;
    await fetchDeliveryAndUpdates();
    try{
      final result=await AuthService.instance.myOrders();
      if(!mounted||loading)return;
      final latest=(result['orders'] as List<dynamic>? ?? []).whereType<Map<String,dynamic>>().toList();
      final existing={for(final order in orders) order['public_id']?.toString():order};
      setState((){
        for(final order in latest){
          final key=order['public_id']?.toString();
          if(key!=null&&existing.containsKey(key)){
            final index=orders.indexOf(existing[key]!);
            if(index>=0)orders[index]=order;
          }
        }
      });
    }catch(_){/* The displayed ledger stays available if background refresh fails. */}
  }
  Future<void> markNotice({int? id,required bool order}) async {
    try{
      if(order)await AuthService.instance.orderNotifications(markAll:id==null,id:id);
      else await AuthService.instance.deliveryRequest(orderId:id,markAll:id==null);
      await fetchDeliveryAndUpdates();
    }catch(_){if(mounted)ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content:Text(tr('Could not mark notification as read.','सूचना पढ़ी गई चिह्नित नहीं हो सकी।'))));}
  }
  String statusText(String raw){
    const labels={
      'created':['Waiting for delivery partner','डिलीवरी साथी की प्रतीक्षा'],
      'assigned':['Partner assigned','डिलीवरी साथी नियुक्त'],
      'picked_up':['Picked up','सामान ले लिया गया'],
      'out_for_delivery':['Out for delivery','डिलीवरी के लिए रवाना'],
      'delivered':['Delivered','डिलीवरी पूरी हुई'],
      'cancelled':['Cancelled','रद्द'],
    };
    return labels[raw]==null?raw:tr(labels[raw]![0],labels[raw]![1]);
  }
  String? codeFor(Map<String,dynamic> delivery){
    if(!['assigned','picked_up','out_for_delivery'].contains(delivery['status']))return null;
    final code=delivery['handoff_code']?.toString();
    return code!=null&&RegExp(r'^[0-9]{6}
    padding:const EdgeInsets.symmetric(vertical:3),
    child:Row(crossAxisAlignment:CrossAxisAlignment.start,children:[
      Expanded(child:Text(label)),
      Expanded(child:Text(value,textAlign:TextAlign.end,
        style:const TextStyle(fontWeight:FontWeight.w700))),
    ]),
  );

  Widget orderCard(Map<String,dynamic> o){
    final items=o['items'] as List<dynamic>? ?? [];
    final assigned=o['delivery_status']!=null;
    final address=[o['house'],o['locality'],o['landmark'],o['city'],o['state'],o['pin']]
      .where((v)=>v!=null&&'$v'.trim().isNotEmpty).join(', ');
    return Card(margin:const EdgeInsets.symmetric(horizontal:12,vertical:6),
      child:ExpansionTile(
        title:Text(o['public_id']?.toString()??'—',style:const TextStyle(fontWeight:FontWeight.w800)),
        subtitle:Text('${ist(o['created_at'])}\n${o['status']} · ${assigned?o['delivery_status']:tr('Awaiting assignment','साथी नियुक्त नहीं')}',
          style:const TextStyle(fontSize:12)),
        trailing:Text(money(o['total']),style:const TextStyle(color:Color(0xFF176B46),fontWeight:FontWeight.w900)),
        children:[Padding(padding:const EdgeInsets.fromLTRB(16,0,16,16),
          child:Column(crossAxisAlignment:CrossAxisAlignment.stretch,children:[
            const Divider(),
            Text(tr('Items','सामान'),style:const TextStyle(fontWeight:FontWeight.w800)),
            for(final raw in items) Builder(builder:(context){
              final line=raw as Map<String,dynamic>;
              return detail('${line['product_name']} · ${line['unit']} × ${line['quantity']}',
                money(line['line_total']));
            }),
            const Divider(),
            detail(tr('Subtotal','सामान कुल'),money(o['subtotal'])),
            detail(tr('Delivery fee','डिलीवरी शुल्क'),money(o['delivery_fee'])),
            detail(tr('Total','कुल'),money(o['total'])),
            const SizedBox(height:9),
            Text(tr('Payment','भुगतान'),style:const TextStyle(fontWeight:FontWeight.w800)),
            Text('${(o['payment_method']??'COD').toString().toUpperCase()} · ${o['payment_status']??'pending'}'),
            if(o['upi_reference']!=null&&'${o['upi_reference']}'.isNotEmpty)
              Text('UPI: ${o['upi_reference']}'),
            if(o['has_receipt']==true)Text(tr('Receipt submitted','रसीद जमा की गई')),
            if(o['submitted_at']!=null)Text('${tr('Submitted','जमा')}: ${ist(o['submitted_at'])}'),
            if(o['verified_at']!=null)Text('${tr('Verified','सत्यापित')}: ${ist(o['verified_at'])}'),
            const SizedBox(height:9),
            Text(tr('Delivery address','डिलीवरी पता'),style:const TextStyle(fontWeight:FontWeight.w800)),
            Text('${o['customer_name']}\n$address'),
            if(o['customer_note']!=null&&'${o['customer_note']}'.trim().isNotEmpty)
              Text('${tr('Instructions','निर्देश')}: ${o['customer_note']}'),
            if(o['delivery_partner_name']!=null)
              Text('${tr('Delivery partner','डिलीवरी साथी')}: ${o['delivery_partner_name']}'),
            Text('${tr('Updated','अपडेट')}: ${ist(o['updated_at'])}',
              style:const TextStyle(fontSize:12,color:Colors.grey)),
            deliverySection(o),
          ]))],
      ));
  }

  @override Widget build(BuildContext context)=>Scaffold(
    appBar:AppBar(title:Text(tr('My orders & deliveries','मेरे ऑर्डर और डिलीवरी')),actions:[
      const LanguageButton(),
      IconButton(onPressed:loading?null:refresh,icon:const Icon(Icons.refresh),
        tooltip:tr('Refresh','ताज़ा करें'))]),
    body:RefreshIndicator(onRefresh:refresh,child:ListView(children:[
      Padding(padding:const EdgeInsets.all(15),
        child:Text(tr('All saved orders, including those awaiting assignment. All times in IST.',
          'सभी ऑर्डर, जिनकी डिलीवरी अभी तय नहीं हुई वे भी। समय IST में।'))),
      if(error!=null)Padding(padding:const EdgeInsets.all(16),child:Text(error!,style:const TextStyle(color:Colors.red))),
      if(orders.isEmpty&&!loading)Padding(padding:const EdgeInsets.all(20),
        child:Text(tr('No orders yet.','अभी कोई ऑर्डर नहीं।'),textAlign:TextAlign.center)),
      for(final o in orders)orderCard(o),
      if(deliveryError!=null)Padding(padding:const EdgeInsets.symmetric(horizontal:18),
        child:Text(deliveryError!,style:const TextStyle(color:Color(0xFF866100)))),
      noticeList(tr('Order notifications','ऑर्डर सूचनाएँ'),orderUpdates,order:true),
      noticeList(tr('Delivery notifications','डिलीवरी सूचनाएँ'),deliveryUpdates,order:false),
      if(hasMore)Padding(padding:const EdgeInsets.all(16),
        child:FilledButton(onPressed:loading?null:load,
          child:Text(tr('Load more','और देखें')))),
      if(loading)const Padding(padding:EdgeInsets.all(22),
        child:Center(child:CircularProgressIndicator())),
    ])),
    bottomNavigationBar: SafeArea(top:false,child:CustomerNavigation(
      active:CustomerNavPage.orders,
      onMarket:()=>Navigator.of(context).popUntil((route)=>route.isFirst),
      onOrders:(){refresh();},
    )),
  );
}
).hasMatch(code)?code:null;
  }
  String qrFor(Map<String,dynamic> delivery,String code){
    final ref=Uri.encodeQueryComponent(delivery['external_order_id'].toString());
    final expected='easymandi://handoff?order=$ref&delivery=${delivery['id']}&code=$code';
    final actual=delivery['handoff_qr'];
    return actual==expected?actual as String:expected;
  }
  Future<void> shareHandoff(Map<String,dynamic> delivery) async {
    final code=codeFor(delivery);
    if(code==null)return;
    final receiver=TextEditingController();
    try{
      final name=await showDialog<String>(context:context,builder:(ctx)=>AlertDialog(
        title:customerDialogTitle(ctx,tr('Share with another receiver','किसी अन्य प्राप्तकर्ता को साझा करें')),
        content:Column(mainAxisSize:MainAxisSize.min,children:[
          Text(tr('Share the code only with someone you trust. It confirms physical delivery.',
            'यह कोड केवल भरोसेमंद व्यक्ति को दें। इससे डिलीवरी पूरी होने की पुष्टि होगी।')),
          const SizedBox(height:12),
          TextField(controller:receiver,maxLength:80,
            decoration:InputDecoration(labelText:tr('Receiver name (optional)','प्राप्तकर्ता का नाम (वैकल्पिक)'))),
        ]),actions:[
          TextButton(onPressed:()=>Navigator.pop(ctx),child:Text(tr('Cancel','रद्द करें'))),
          FilledButton(onPressed:()=>Navigator.pop(ctx,receiver.text.trim()),
            child:Text(tr('Share code and QR','कोड और QR साझा करें'))),
        ]));
      if(name==null||!mounted)return;
      final painter=QrPainter(data:qrFor(delivery,code),version:QrVersions.auto,gapless:true);
      final image=await painter.toImageData(640,format:ui.ImageByteFormat.png);
      if(image==null)throw StateError('QR unavailable');
      final message='Easy Mandi order ${delivery['external_order_id']}\n'
        '${name.isEmpty?'':'Receiver: $name\n'}'
        'Delivery handoff code: $code\n'
        'Show this QR or code to the partner only after receiving the items.';
      await Share.shareXFiles([XFile.fromData(image.buffer.asUint8List(),mimeType:'image/png')],
        text:message,fileNameOverrides:['easy-mandi-handoff.png']);
    }catch(_){
      if(mounted)ScaffoldMessenger.of(context).showSnackBar(SnackBar(content:Text(
        tr('Could not share the QR. Please try again.','QR साझा नहीं हुआ। फिर से प्रयास करें।'))));
    }finally{receiver.dispose();}
  }
  Widget deliverySection(Map<String,dynamic> order){
    final delivery=deliveries[order['public_id']?.toString()];
    final status=delivery?['status']?.toString()??order['delivery_status']?.toString();
    if(delivery==null&&status==null)return Padding(padding:const EdgeInsets.only(top:10),
      child:Text(tr('Order saved · awaiting delivery assignment','ऑर्डर सुरक्षित · डिलीवरी साथी की प्रतीक्षा'),
        style:const TextStyle(color:Color(0xFF866100))));
    final code=delivery==null?null:codeFor(delivery);
    return Column(crossAxisAlignment:CrossAxisAlignment.start,children:[
      const SizedBox(height:12),
      const Divider(),
      Text(tr('Delivery and handoff','डिलीवरी और हैंडऑफ'),
        style:const TextStyle(fontWeight:FontWeight.w800,fontSize:16)),
      Text(status==null?tr('Awaiting assignment','नियुक्ति की प्रतीक्षा'):statusText(status)),
      if(code!=null&&delivery!=null)Card(color:const Color(0xFFEAF6EE),child:Padding(
        padding:const EdgeInsets.all(14),child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[
          Text(tr('Six-digit handoff code','छह अंकों का हैंडऑफ कोड'),
            style:const TextStyle(fontWeight:FontWeight.w800)),
          SelectableText(code,style:const TextStyle(fontSize:30,fontWeight:FontWeight.w900,letterSpacing:4)),
          Text(tr('Show the code or QR only after receiving the order.',
            'सामान मिलने के बाद ही कोड या QR दिखाएँ।')),
          const SizedBox(height:12),
          Center(child:Container(color:Colors.white,padding:const EdgeInsets.all(8),
            child:QrImageView(data:qrFor(delivery,code),size:165))),
          const SizedBox(height:12),
          FilledButton.icon(onPressed:()=>shareHandoff(delivery),icon:const Icon(Icons.share),
            label:Text(tr('Share code + QR','कोड और QR साझा करें'))),
          if(delivery['code_expires_at']!=null)
            Text('${tr('Code valid until','कोड मान्य')}: ${delivery['code_expires_at']}'),
        ]))),
      if(code==null&&['assigned','picked_up','out_for_delivery'].contains(status))
        Text(tr('Handoff code is unavailable. Ask the admin to reissue it and refresh.',
          'कोड उपलब्ध नहीं है। व्यवस्थापक से नया कोड लेकर रीफ़्रेश करें।')),
      if(status=='delivered'||status=='cancelled')
        Text(tr('The handoff code is no longer active.','हैंडऑफ कोड अब सक्रिय नहीं है।')),
    ]);
  }
  Widget noticeList(String heading,List<dynamic> updates,{required bool order}){
    if(updates.isEmpty)return const SizedBox.shrink();
    final unread=updates.where((n)=>n is Map&&n['read_at']==null).length;
    return ExpansionTile(title:Text('$heading · $unread ${tr('unread','अपठित')}'),children:[
      TextButton(onPressed:()=>markNotice(order:order),child:Text(tr('Mark all as read','सभी पढ़ लिए'))),
      for(final raw in updates)if(raw is Map<String,dynamic>)ListTile(
        leading:Icon(raw['read_at']==null?Icons.notifications_active:Icons.notifications_none),
        title:Text(raw['message']?.toString()??tr('Order update','ऑर्डर अपडेट')),
        subtitle:Text(raw['created_at']?.toString()??''),
        onTap:()=>markNotice(id:(raw['id'] as num).toInt(),order:order),
      ),
    ]);
  }

  Widget detail(String label,String value)=>Padding(
    padding:const EdgeInsets.symmetric(vertical:3),
    child:Row(crossAxisAlignment:CrossAxisAlignment.start,children:[
      Expanded(child:Text(label)),
      Expanded(child:Text(value,textAlign:TextAlign.end,
        style:const TextStyle(fontWeight:FontWeight.w700))),
    ]),
  );

  Widget orderCard(Map<String,dynamic> o){
    final items=o['items'] as List<dynamic>? ?? [];
    final assigned=o['delivery_status']!=null;
    final address=[o['house'],o['locality'],o['landmark'],o['city'],o['state'],o['pin']]
      .where((v)=>v!=null&&'$v'.trim().isNotEmpty).join(', ');
    return Card(margin:const EdgeInsets.symmetric(horizontal:12,vertical:6),
      child:ExpansionTile(
        title:Text(o['public_id']?.toString()??'—',style:const TextStyle(fontWeight:FontWeight.w800)),
        subtitle:Text('${ist(o['created_at'])}\n${o['status']} · ${assigned?o['delivery_status']:tr('Awaiting assignment','साथी नियुक्त नहीं')}',
          style:const TextStyle(fontSize:12)),
        trailing:Text(money(o['total']),style:const TextStyle(color:Color(0xFF176B46),fontWeight:FontWeight.w900)),
        children:[Padding(padding:const EdgeInsets.fromLTRB(16,0,16,16),
          child:Column(crossAxisAlignment:CrossAxisAlignment.stretch,children:[
            const Divider(),
            Text(tr('Items','सामान'),style:const TextStyle(fontWeight:FontWeight.w800)),
            for(final raw in items) Builder(builder:(context){
              final line=raw as Map<String,dynamic>;
              return detail('${line['product_name']} · ${line['unit']} × ${line['quantity']}',
                money(line['line_total']));
            }),
            const Divider(),
            detail(tr('Subtotal','सामान कुल'),money(o['subtotal'])),
            detail(tr('Delivery fee','डिलीवरी शुल्क'),money(o['delivery_fee'])),
            detail(tr('Total','कुल'),money(o['total'])),
            const SizedBox(height:9),
            Text(tr('Payment','भुगतान'),style:const TextStyle(fontWeight:FontWeight.w800)),
            Text('${(o['payment_method']??'COD').toString().toUpperCase()} · ${o['payment_status']??'pending'}'),
            if(o['upi_reference']!=null&&'${o['upi_reference']}'.isNotEmpty)
              Text('UPI: ${o['upi_reference']}'),
            if(o['has_receipt']==true)Text(tr('Receipt submitted','रसीद जमा की गई')),
            if(o['submitted_at']!=null)Text('${tr('Submitted','जमा')}: ${ist(o['submitted_at'])}'),
            if(o['verified_at']!=null)Text('${tr('Verified','सत्यापित')}: ${ist(o['verified_at'])}'),
            const SizedBox(height:9),
            Text(tr('Delivery address','डिलीवरी पता'),style:const TextStyle(fontWeight:FontWeight.w800)),
            Text('${o['customer_name']}\n$address'),
            if(o['customer_note']!=null&&'${o['customer_note']}'.trim().isNotEmpty)
              Text('${tr('Instructions','निर्देश')}: ${o['customer_note']}'),
            if(o['delivery_partner_name']!=null)
              Text('${tr('Delivery partner','डिलीवरी साथी')}: ${o['delivery_partner_name']}'),
            Text('${tr('Updated','अपडेट')}: ${ist(o['updated_at'])}',
              style:const TextStyle(fontSize:12,color:Colors.grey)),
            if(!assigned)Text(tr('Order saved. No delivery partner assigned yet.',
              'ऑर्डर सुरक्षित है, डिलीवरी साथी अभी नियुक्त नहीं हुआ है।'),
              style:const TextStyle(color:Color(0xFF866100))),
          ]))],
      ));
  }

  @override Widget build(BuildContext context)=>Scaffold(
    appBar:AppBar(title:Text(tr('My orders','मेरे ऑर्डर')),actions:[
      const LanguageButton(),
      IconButton(onPressed:loading?null:refresh,icon:const Icon(Icons.refresh),
        tooltip:tr('Refresh','ताज़ा करें'))]),
    body:RefreshIndicator(onRefresh:refresh,child:ListView(children:[
      Padding(padding:const EdgeInsets.all(15),
        child:Text(tr('All saved orders, including those awaiting assignment. All times in IST.',
          'सभी ऑर्डर, जिनकी डिलीवरी अभी तय नहीं हुई वे भी। समय IST में।'))),
      if(error!=null)Padding(padding:const EdgeInsets.all(16),child:Text(error!,style:const TextStyle(color:Colors.red))),
      if(orders.isEmpty&&!loading)Padding(padding:const EdgeInsets.all(20),
        child:Text(tr('No orders yet.','अभी कोई ऑर्डर नहीं।'),textAlign:TextAlign.center)),
      for(final o in orders)orderCard(o),
      if(hasMore)Padding(padding:const EdgeInsets.all(16),
        child:FilledButton(onPressed:loading?null:load,
          child:Text(tr('Load more','और देखें')))),
      if(loading)const Padding(padding:EdgeInsets.all(22),
        child:Center(child:CircularProgressIndicator())),
    ])),
    bottomNavigationBar: SafeArea(top:false,child:CustomerNavigation(
      active:CustomerNavPage.orders,
      onMarket:()=>Navigator.of(context).popUntil((route)=>route.isFirst),
      onOrders:(){refresh();},
    )),
  );
}
