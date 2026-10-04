import 'package:flutter/material.dart';
import 'i18n.dart';

final notificationNavigator = GlobalKey<NavigatorState>();
final notificationFeed = ValueNotifier<List<Map<String,dynamic>>>([]);
Future<void> Function(Map<String,dynamic>?)? notificationMark;

Widget notificationOverlay(BuildContext context, Widget? child) => Column(children:[
  Expanded(child:child ?? const SizedBox.shrink()),
  SafeArea(top:false,child:Padding(padding:const EdgeInsets.fromLTRB(12,0,12,8),child:Material(
    elevation:8,borderRadius:BorderRadius.circular(14),color:const Color(0xFFE8F2FC),
    child:ValueListenableBuilder<List<Map<String,dynamic>>>(valueListenable:notificationFeed,builder:(context,items,_) {
      final unread=items.where((n)=>n['read_at']==null).length;
      final latest=items.isEmpty?tr('No notifications yet.','अभी कोई सूचना नहीं।'):(items.first['message'] as String? ?? tr('Update','अपडेट'));
      return Padding(padding:const EdgeInsets.all(12),child:Column(mainAxisSize:MainAxisSize.min,crossAxisAlignment:CrossAxisAlignment.start,children:[
        Row(children:[Expanded(child:Text(tr('Notifications · $unread unread','सूचनाएँ · $unread अपठित'),style:const TextStyle(fontWeight:FontWeight.bold))),
          TextButton(onPressed:showNotificationModal,child:Text(tr('View all','सभी देखें')))]),
        Text(latest,maxLines:2,overflow:TextOverflow.ellipsis)
      ]));
    }))))
]);

Future<void> showNotificationModal() async {
  final context=notificationNavigator.currentContext;
  if(context==null)return;
  await showDialog<void>(context:context,builder:(dialogContext)=>AlertDialog(
    title:Text(tr('Notifications','सूचनाएँ')),
    content:SizedBox(width:520,height:350,child:ValueListenableBuilder<List<Map<String,dynamic>>>(
      valueListenable:notificationFeed,builder:(context,items,_)=>items.isEmpty?Center(child:Text(tr('No notifications yet.','अभी कोई सूचना नहीं।'))):
        ListView(children:[for(final n in items)ListTile(
          leading:Icon(n['read_at']==null?Icons.notifications_active:Icons.notifications_none),
          title:Text(n['message'] as String? ?? tr('Update','अपडेट')),subtitle:Text(n['created_at'] as String? ?? ''),
          trailing:n['read_at']==null?IconButton(tooltip:tr('Mark as read','पढ़ा हुआ चिन्हित करें'),icon:const Icon(Icons.done),onPressed:()async{
            try{await notificationMark?.call(n);}catch(_){if(dialogContext.mounted)ScaffoldMessenger.of(dialogContext).showSnackBar(SnackBar(content:Text(tr('Could not mark as read. Please retry.','पढ़ा हुआ चिन्हित नहीं हो सका। कृपया फिर प्रयास करें।'))));}
          }):null
        )])
    )),
    actions:[TextButton(onPressed:()async{try{await notificationMark?.call(null);}catch(_){if(dialogContext.mounted)ScaffoldMessenger.of(dialogContext).showSnackBar(SnackBar(content:Text(tr('Could not mark as read. Please retry.','पढ़ा हुआ चिन्हित नहीं हो सका। कृपया फिर प्रयास करें।'))));}},child:Text(tr('Mark all as read','सभी को पढ़ा हुआ चिन्हित करें'))),
      TextButton(onPressed:()=>Navigator.pop(dialogContext),child:Text(tr('Close','बंद करें')))]
  ));
}
