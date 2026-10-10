import 'package:flutter/material.dart';
import 'i18n.dart';
import 'customer_dialog_title.dart';

final notificationNavigator = GlobalKey<NavigatorState>();
final notificationFeed = ValueNotifier<List<Map<String,dynamic>>>([]);
Future<void> Function(Map<String,dynamic>?)? notificationMark;

// Customer notifications are opened from My Account instead of taking
// permanent space at the bottom of every shopping screen.
Widget notificationOverlay(BuildContext context, Widget? child) =>
    child ?? const SizedBox.shrink();

Future<void> showNotificationModal() async {
  final context=notificationNavigator.currentContext;
  if(context==null)return;
  await showDialog<void>(context:context,builder:(dialogContext)=>AlertDialog(
    title:customerDialogTitle(dialogContext,tr('Notifications','सूचनाएँ')),
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
