import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'auth_service.dart';
import 'local_store.dart';
import 'i18n.dart';

/// Secure account-backed address manager, shared with website through the API.
class SavedAddressesPage extends StatefulWidget {
  const SavedAddressesPage({super.key});
  @override
  State<SavedAddressesPage> createState() => _SavedAddressesPageState();
}

class _SavedAddressesPageState extends State<SavedAddressesPage> {
  List<SavedAddress> addresses=[];
  List<String> localities=[];
  bool loading=true,busy=false;
  String? error;

  @override
  void initState(){super.initState();load();}

  Future<List<String>> fetchLocalities() async {
    final client=HttpClient()..connectionTimeout=const Duration(seconds:8);
    try{
      final request=await client.getUrl(Uri.parse(authApiBase+'/localities.php'));
      final response=await request.close().timeout(const Duration(seconds:10));
      if(response.statusCode!=200)throw const FormatException('Localities unavailable');
      final json=jsonDecode(await response.transform(utf8.decoder).join()) as Map<String,dynamic>;
      return (json['localities'] as List)
        .map((e)=>Map<String,dynamic>.from(e as Map)['name'])
        .whereType<String>().toList();
    }finally{client.close(force:true);}
  }

  Future<void> load() async {
    if(!mounted)return;
    setState((){loading=true;error=null;});
    try{
      final result=await AuthService.instance.customerData();
      final areas=await fetchLocalities();
      if(!mounted)return;
      final list=(result['addresses'] as List? ?? [])
        .map((a)=>SavedAddress.fromRow(Map<String,Object?>.from(a as Map))).toList();
      setState((){addresses=list;localities=areas;loading=false;});
    }catch(e){
      if(mounted)setState((){loading=false;error=e is AuthException?e.message:
        tr('Saved addresses unavailable. Retry.','सहेजे पते उपलब्ध नहीं हैं। फिर प्रयास करें।');});
    }
  }

  Future<void> change(Future<void> Function() action) async {
    if(busy)return;
    setState(()=>busy=true);
    try{await action();await load();}
    catch(e){if(mounted)setState(()=>error=e is AuthException?e.message:
      tr('Could not update address.','पता अपडेट नहीं हुआ।'));}
    finally{if(mounted)setState(()=>busy=false);}
  }

  Future<void> edit([SavedAddress? address]) async {
    if(localities.isEmpty)return;
    final key=GlobalKey<FormState>();
    final name=TextEditingController(text:address?.name??AuthService.instance.user?.name??'');
    final house=TextEditingController(text:address?.house??'');
    final landmark=TextEditingController(text:address?.landmark??'');
    final pin=TextEditingController(text:address?.pin??'');
    String? area=localities.contains(address?.locality)?address!.locality:null;
    bool isPrimary=address?.isPrimary??addresses.isEmpty;
    final proceed=await showDialog<bool>(context:context,builder:(context)=>StatefulBuilder(
      builder:(context,update)=>AlertDialog(
        title:Text(address==null?tr('Add address','नया पता'):tr('Edit address','पता बदलें')),
        content:SizedBox(width:420,child:Form(key:key,child:SingleChildScrollView(
          child:Column(mainAxisSize:MainAxisSize.min,children:[
            TextFormField(controller:name,
              decoration:InputDecoration(labelText:tr('Recipient name','नाम')),
              validator:(v)=>(v?.trim().length??0)<2?tr('Enter a name','नाम दर्ज करें'):null),
            DropdownButtonFormField<String>(
              initialValue:area,isExpanded:true,
              decoration:InputDecoration(labelText:tr('Delivery locality','डिलीवरी क्षेत्र')),
              items:localities.map((v)=>DropdownMenuItem<String>(
                value:v,child:Text(v,overflow:TextOverflow.ellipsis))).toList(),
              onChanged:(v)=>update(()=>area=v),
              validator:(v)=>localities.contains(v)?null:tr('Choose a served locality','उपलब्ध क्षेत्र चुनें')),
            TextFormField(controller:house,
              decoration:InputDecoration(labelText:tr('House / flat / building','मकान / फ्लैट')),
              validator:(v)=>(v?.trim().length??0)<2?tr('Enter house details','मकान का पता डालें'):null),
            TextFormField(controller:landmark,
              decoration:InputDecoration(labelText:tr('Landmark (optional)','पहचान (वैकल्पिक)'))),
            TextFormField(controller:pin,keyboardType:TextInputType.number,
              inputFormatters:[FilteringTextInputFormatter.digitsOnly,LengthLimitingTextInputFormatter(6)],
              decoration:InputDecoration(labelText:tr('PIN (optional)','पिन (वैकल्पिक)')),
              validator:(v)=>v==null||v.trim().isEmpty||RegExp(r'^[1-9][0-9]{5}$').hasMatch(v.trim())?
                null:tr('Enter a valid six-digit PIN','छह अंकों का पिन डालें')),
            SwitchListTile(title:Text(tr('Make primary address','मुख्य पता बनाएँ')),
              value:isPrimary,onChanged:address?.isPrimary==true?null:(v)=>update(()=>isPrimary=v)),
          ])))),
        actions:[
          TextButton(onPressed:()=>Navigator.pop(context,false),child:Text(tr('Cancel','रद्द करें'))),
          FilledButton(onPressed:(){
            if(key.currentState!.validate())Navigator.pop(context,true);
          },child:Text(tr('Save','सहेजें'))),
        ],
      )));
    if(proceed==true){
      await change(()=>AuthService.instance.saveServerAddress({
        'operation':'save',if(address?.id!=null)'id':address!.id,
        'name':name.text.trim(),'phone':AuthService.instance.user!.mobile,
        'house':house.text.trim(),'locality':area!,'landmark':landmark.text.trim(),
        'pin':pin.text.trim(),'setPrimary':isPrimary,
      }));
    }
    name.dispose();house.dispose();landmark.dispose();pin.dispose();
  }

  Future<void> delete(SavedAddress address) async {
    final ok=await showDialog<bool>(context:context,builder:(context)=>AlertDialog(
      title:Text(tr('Delete address?','पता हटाएँ?')),
      content:Text(address.house+', '+address.locality),
      actions:[
        TextButton(onPressed:()=>Navigator.pop(context,false),child:Text(tr('Cancel','रद्द करें'))),
        FilledButton(onPressed:()=>Navigator.pop(context,true),child:Text(tr('Delete','हटाएँ'))),
      ]));
    if(ok==true&&address.id!=null)await change(()=>AuthService.instance.deleteServerAddress(address.id!));
  }

  @override
  Widget build(BuildContext context)=>Scaffold(
    appBar:AppBar(title:Text(tr('My saved addresses','मेरे सहेजे पते'))),
    body:loading?const Center(child:CircularProgressIndicator()):
    RefreshIndicator(onRefresh:load,child:ListView(padding:const EdgeInsets.all(16),children:[
      if(error!=null)Padding(padding:const EdgeInsets.all(12),
        child:Text(error!,style:const TextStyle(color:Colors.red))),
      if(addresses.isEmpty)Padding(padding:const EdgeInsets.symmetric(vertical:24),
        child:Text(tr('No saved addresses yet. Add one for faster checkout.','अभी पता सहेजा नहीं है। तेज़ चेकआउट के लिए जोड़ें।'))),
      ...addresses.map((address)=>Card(child:Padding(padding:const EdgeInsets.all(12),
        child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[
          Text(address.name,style:Theme.of(context).textTheme.titleMedium),
          Text([address.house,address.locality,address.landmark,address.pin]
            .where((s)=>s.isNotEmpty).join(', ')),
          if(address.isPrimary)Chip(label:Text(tr('★ Primary / Default','★ मुख्य पता'))),
          Wrap(spacing:8,children:[
            TextButton(onPressed:busy?null:()=>edit(address),child:Text(tr('Edit','बदलें'))),
            if(!address.isPrimary)TextButton(
              onPressed:busy?null:()=>change(()=>AuthService.instance.setPrimaryServerAddress(address.id!)),
              child:Text(tr('Set primary','मुख्य बनाएँ'))),
            TextButton(onPressed:busy?null:()=>delete(address),child:Text(tr('Delete','हटाएँ'))),
          ]),
        ])))),
      const SizedBox(height:12),
      FilledButton.icon(onPressed:busy||localities.isEmpty?null:()=>edit(),
        icon:const Icon(Icons.add_location_alt_outlined),
        label:Text(tr('Add new address','नया पता जोड़ें'))),
      if(localities.isEmpty)Text(tr('Serviced localities unavailable; retry online.','क्षेत्र उपलब्ध नहीं हैं। ऑनलाइन पुनः प्रयास करें।')),
    ])),
  );
}
