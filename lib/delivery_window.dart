import 'package:flutter/material.dart';
import 'i18n.dart';

/// Easy Mandi 07:00-23:00 IST checkout cutoff, including 07:00, excluding 23:00.
bool easyMandiCheckoutOpen([DateTime? at]){
  final local=(at??DateTime.now()).toUtc().add(const Duration(hours:5,minutes:30));
  return local.hour>=7&&local.hour<23;
}
/// Delivery Policy V2: use recorded confirmation, carrying service minutes overnight.
DateTime? easyMandiOrderTime(dynamic raw) {
  if (raw == null) return null;
  if (raw is DateTime) return raw;
  var text = raw.toString().trim();
  if (text.isEmpty) return null;
  if (RegExp(r'^\d{4}-\d\d-\d\d[ T]\d\d:\d\d').hasMatch(text) &&
      !RegExp(r'(?:Z|[+-]\d\d:?\d\d)$', caseSensitive: false).hasMatch(text)) {
    text = text.replaceFirst(' ', 'T') + '+05:30';
  }
  return DateTime.tryParse(text);
}

String easyMandiClockIst(DateTime date) {
  final ist = date.toUtc().add(const Duration(hours: 5, minutes: 30));
  String two(int n) => n.toString().padLeft(2, '0');
  return '${two(ist.hour)}:${two(ist.minute)}';
}

DateTime? easyMandiAttemptTarget(dynamic value){
  final confirmed=easyMandiOrderTime(value);
  if(confirmed==null)return null;
  const offset=Duration(hours:5,minutes:30);
  var local=confirmed.toUtc().add(offset);
  var start=DateTime.utc(local.year,local.month,local.day,7);
  final close=DateTime.utc(local.year,local.month,local.day,23);
  if(local.isBefore(start))local=start;
  else if(!local.isBefore(close)){
    start=start.add(const Duration(days:1));
    local=start;
  }
  final end=DateTime.utc(local.year,local.month,local.day,23);
  final remaining=end.difference(local);
  final due=remaining>=const Duration(minutes:60)
    ?local.add(const Duration(minutes:60))
    :DateTime.utc(local.year,local.month,local.day+1,7)
       .add(const Duration(minutes:60)).subtract(remaining);
  return due.subtract(offset);
}
String easyMandiDeliveryWindowText(dynamic confirmedAt,{dynamic placedAt,dynamic targetAt}){
  final confirmed=easyMandiOrderTime(confirmedAt),placed=easyMandiOrderTime(placedAt);
  const english='Delivery attempted within 60 service minutes after confirmation (7 AM–11 PM IST). Rush-hour, traffic or high-demand delays are possible. Keep ordering with Easy Mandi and save at MANDI rates.';
  const hindi='पुष्टि के बाद 60 कार्य मिनट में डिलीवरी का प्रयास (सुबह 7 से रात 11 बजे तक)। ट्रैफिक या अधिक ऑर्डर के कारण देरी हो सकती है। मंडी भाव पर बचत के लिए ऑर्डर करते रहें।';
  if(confirmed==null){
    return (placed==null?'':'${tr('Order time','ऑर्डर समय')}: ${easyMandiClockIst(placed)} IST · ')+
      tr('Awaiting order confirmation. ','ऑर्डर की पुष्टि बाकी है। ')+tr(english,hindi);
  }
  final target=easyMandiOrderTime(targetAt)??easyMandiAttemptTarget(confirmed)!;
  final a=confirmed.toUtc().add(const Duration(hours:5,minutes:30));
  final b=target.toUtc().add(const Duration(hours:5,minutes:30));
  final next=(a.day!=b.day || a.month!=b.month || a.year!=b.year);
  final nextDay=next?' (${b.day}/${b.month})':'';
  return '${tr('Confirmed','पुष्टि')}: ${easyMandiClockIst(confirmed)} IST · '
    '${tr('Delivery attempt target','डिलीवरी प्रयास लक्ष्य')}: ${easyMandiClockIst(target)}$nextDay IST.\n'
    '${tr(english,hindi)}';
}

Widget easyMandiDeliveryWindowBanner(dynamic confirmedAt,{dynamic placedAt,dynamic targetAt}) => Container(
  margin: const EdgeInsets.symmetric(vertical: 7),
  padding: const EdgeInsets.all(11),
  decoration: BoxDecoration(
    color: const Color(0xFFEFF8FE),
    border: Border.all(color: const Color(0xFFB9D9EB)),
    borderRadius: BorderRadius.circular(10),
  ),
  child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
    const Icon(Icons.local_shipping_outlined, color: Color(0xFF17618A), size: 19),
    const SizedBox(width: 8),
    Expanded(child: Text(easyMandiDeliveryWindowText(confirmedAt,placedAt:placedAt,targetAt:targetAt),
      style: const TextStyle(fontSize: 12.5, height: 1.5, fontWeight: FontWeight.w600,
        color: Color(0xFF204E6C)))),
  ]),
);

/* V3 compact, non-overlay policy guidance on the customer market screen.
 * Recorded order confirmation and checkout notices keep their V2 widgets. */
enum CatalogDeliveryMode { expanded, compact, dismissed }

class CatalogDeliveryNotice extends StatelessWidget {
  const CatalogDeliveryNotice({super.key,required this.mode,required this.onToggle,
    required this.onDismiss,required this.onPolicyTap});
  final CatalogDeliveryMode mode;
  final VoidCallback onToggle, onDismiss, onPolicyTap;
  @override
  Widget build(BuildContext context) {
    if (mode==CatalogDeliveryMode.dismissed) return const SizedBox.shrink();
    final expanded=mode==CatalogDeliveryMode.expanded;
    return Container(
      margin:const EdgeInsets.fromLTRB(14,6,14,5),
      padding:EdgeInsets.symmetric(horizontal:expanded?11:9,vertical:expanded?9:4),
      decoration:BoxDecoration(
        color:const Color(0xFFF3FAFD),
        border:Border.all(color:const Color(0xFFCBDDE7)),
        borderRadius:BorderRadius.circular(12),
      ),
      child:Row(crossAxisAlignment:CrossAxisAlignment.center,children:[
        const Icon(Icons.local_shipping_outlined,color:Color(0xFF176B46),size:20),
        const SizedBox(width:7),
        Expanded(child:expanded
          ?Column(crossAxisAlignment:CrossAxisAlignment.start,children:[
              Text(tr('Your delivery window','आपकी डिलीवरी का समय'),
                style:const TextStyle(color:Color(0xFF176B46),fontSize:12,fontWeight:FontWeight.w800)),
              const SizedBox(height:3),
              Text(tr('We aim to attempt delivery within 60 service minutes after confirmation. Ordering hours: 7 AM–11 PM IST; delays are possible.',
                'पुष्टि के बाद 60 कार्य मिनट में डिलीवरी का प्रयास। ऑर्डर का समय: सुबह 7 से रात 11 तक; देरी संभव है।'),
                style:const TextStyle(color:Color(0xFF204E6C),fontSize:12,height:1.3)),
              Align(alignment:Alignment.centerLeft,
                child:TextButton(
                  onPressed:onPolicyTap,
                  style:TextButton.styleFrom(padding:EdgeInsets.zero,visualDensity:VisualDensity.compact),
                  child:Text(tr('View full policy','पूरी नीति देखें'),
                    style:const TextStyle(fontWeight:FontWeight.w700,fontSize:12)))),
            ])
          :Text(tr('60-min delivery attempt · 7 AM–11 PM','60 मिनट में डिलीवरी प्रयास · सुबह 7–रात 11'),
              maxLines:1,overflow:TextOverflow.ellipsis,
              style:const TextStyle(fontSize:12,fontWeight:FontWeight.w800,color:Color(0xFF214C62)))),
        IconButton(
          tooltip:expanded?tr('Minimise delivery notice','डिलीवरी संदेश छोटा करें'):tr('Expand delivery notice','डिलीवरी संदेश खोलें'),
          onPressed:onToggle,visualDensity:VisualDensity.compact,
          constraints:const BoxConstraints(minWidth:36,minHeight:36),
          icon:Icon(expanded?Icons.keyboard_arrow_up:Icons.keyboard_arrow_down,size:21)),
        IconButton(
          tooltip:tr('Close delivery notice','डिलीवरी संदेश बंद करें'),
          onPressed:onDismiss,visualDensity:VisualDensity.compact,
          constraints:const BoxConstraints(minWidth:36,minHeight:36),
          icon:const Icon(Icons.close,size:17)),
      ]),
    );
  }
}
