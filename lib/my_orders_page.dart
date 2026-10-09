import 'package:flutter/material.dart';
import 'auth_service.dart';
import 'i18n.dart';

class MyOrdersPage extends StatefulWidget {
  const MyOrdersPage({super.key});
  @override State<MyOrdersPage> createState()=>_MyOrdersPageState();
}
class _MyOrdersPageState extends State<MyOrdersPage> {
  final List<Map<String,dynamic>> orders=[];
  bool loading=false,hasMore=false;
  int page=0;
  String? error;

  String money(dynamic n)=>'₹${(num.tryParse('$n')??0).toStringAsFixed(2)}';
  String ist(dynamic text){
    if(text==null||text=='')return '—';
    final parsed=DateTime.tryParse('$text');
    if(parsed==null)return '$text IST';
    final date=parsed.toUtc().add(const Duration(hours:5,minutes:30));
    String two(int n)=>n.toString().padLeft(2,'0');
    return '${two(date.day)}/${two(date.month)}/${date.year} ${two(date.hour)}:${two(date.minute)} IST';
  }

  @override void initState(){super.initState();load();}
  Future<void> refresh()async{
    if(loading)return;
    setState((){orders.clear();page=0;hasMore=false;error=null;});
    await load();
  }
  Future<void> load()async{
    if(loading)return;
    setState(()=>loading=true);
    try{
      final result=await AuthService.instance.myOrders(page:page+1);
      if(!mounted)return;
      final list=(result['orders'] as List<dynamic>? ?? [])
          .whereType<Map<String,dynamic>>().toList();
      setState((){orders.addAll(list);page++;hasMore=result['hasMore']==true;error=null;});
    }on AuthException catch(e){if(mounted)setState(()=>error=localizeError(e.message));}
    catch(_){if(mounted)setState(()=>error=tr('Orders could not be loaded.','ऑर्डर लोड नहीं हुए।'));}
    finally{if(mounted)setState(()=>loading=false);}
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
  );
}
