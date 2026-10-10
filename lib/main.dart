import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:geolocator/geolocator.dart';
import 'package:image_picker/image_picker.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'account_page.dart';
import 'auth_service.dart';
import 'google_customer_sign_in.dart';
import 'my_orders_page.dart';
import 'local_store.dart';
import 'recent_order_items.dart';
import 'product.dart';
import 'store_gallery.dart';
import 'checkout_utils.dart';
import 'notification_overlay.dart';
import 'notification_settings.dart';
import 'customer_dialog_title.dart';
import 'customer_navigation.dart';
import 'i18n.dart';

const catalogUrl =
    'https://cserver.learnwithchampak.live/easymandi/api/catalog.php';
const forest = Color(0xFF176B46);
const pale = Color(0xFFF4F8F3);

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Deliberate one-time customer reset for the October 2026 fresh start.
  // Keep the catalog and the application's language preference intact.
  final prefs=await SharedPreferences.getInstance();
  const migrationKey='easy-mandi-fresh-start-20261009';
  if(prefs.getBool(migrationKey)!=true){
    await AuthService.instance.clearLocalAccountForFreshStart();
    await LocalStore.instance.clearPersonalData();
    // Old address migration flags must not apply to new customer IDs.
    for(final key in prefs.getKeys().where((key)=>key.startsWith('server-address-migration-')).toList()){
      await prefs.remove(key);
    }
    await prefs.remove('cart');
    await prefs.remove('easy-mandi-favorites');
    await prefs.setBool(migrationKey,true);
  }
  await EasyMandiLanguage.load();
  runApp(const EasyMandiApp());
}

class EasyMandiApp extends StatelessWidget {
  const EasyMandiApp({super.key});
  @override
  Widget build(BuildContext context) => ValueListenableBuilder<bool>(
        valueListenable: EasyMandiLanguage.hindi,
        builder: (context, _, __) => MaterialApp(
          navigatorKey: notificationNavigator,
          builder: notificationOverlay,
          title: 'Easy Mandi',
          debugShowCheckedModeBanner: false,
          theme: ThemeData(
            useMaterial3: true,
            colorScheme: ColorScheme.fromSeed(seedColor: forest, surface: pale),
            scaffoldBackgroundColor: pale,
            appBarTheme: const AppBarTheme(backgroundColor: pale),
            inputDecorationTheme: InputDecorationTheme(
              filled: true,
              fillColor: Colors.white,
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide.none),
            ),
          ),
          home: const StorePage(),
        ),
      );
}

class StorePage extends StatefulWidget {
  const StorePage({super.key});
  @override
  State<StorePage> createState() => _StorePageState();
}

class _StorePageState extends State<StorePage> {
  List<Product> products = [];
  List<String> popularProductIds = [];
  List<RecentItem> recentItems = [];
  bool recentItemsLoading = false;
  String? recentItemsError;
  AuthUser? signedInUser;
  Map<String, dynamic> store = {};
  Map<String, dynamic> checkoutRules = {};
  List<String> categories = ['All'];
  final Set<String> favoriteIds = {};
  bool favoritesOnly = false;
  final Map<String, int> cart = {};
  final TextEditingController _searchController = TextEditingController();
  Future<void> _cartWrite = Future.value();
  String? _pendingOrderKey;
  String category = 'All', query = '', message = '';
  int marketResetSerial = 0;
  Timer? notificationTimer;
  bool checkingNotifications=false;
  int? notificationUserId;
  bool notificationsPrimed=false;
  final Set<String> shownNotifications={};
  bool loading = true;

  void _languageChanged() {
    if (mounted) setState(() {});
  }

  @override
  void initState() {
    super.initState();
    EasyMandiLanguage.hindi.addListener(_languageChanged);
    notificationMark=(n) async {
      if(n==null || n['_audience']=='order')await AuthService.instance.orderNotifications(markAll:n==null,id:n==null?null:notificationId(n));
      if(n==null || n['_audience']=='delivery')await AuthService.instance.deliveryRequest(markAll:n==null,orderId:n==null?null:notificationId(n));
      await checkNotifications();
    };
    loadCatalog();
    loadPopularProducts();
    loadFavorites();
    restoreAccount();
    notificationTimer=Timer.periodic(const Duration(minutes:5),(_)=>checkNotifications());
  }

  @override
  void dispose(){
    EasyMandiLanguage.hindi.removeListener(_languageChanged);
    notificationTimer?.cancel();
    _searchController.dispose();
    super.dispose();
  }
  Future<void> loadFavorites() async {
    try {
      final prefs=await SharedPreferences.getInstance();
      if(mounted)setState(()=>favoriteIds
        ..clear()
        ..addAll(prefs.getStringList('easy-mandi-favorites')??<String>[]));
    } catch (_) { /* Browsing and ordering work without local favorites. */ }
  }

  Future<void> toggleFavorite(Product p) async {
    setState((){
      if(!favoriteIds.add(p.id))favoriteIds.remove(p.id);
    });
    try {
      final prefs=await SharedPreferences.getInstance();
      await prefs.setStringList('easy-mandi-favorites',favoriteIds.toList());
    }catch(_){
      if(mounted)ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content:Text(tr('Could not save favorites.','पसंदीदा सहेजे नहीं जा सके।'))));
    }
  }

  Future<void> saveCustomerAddress(SavedAddress address) async {
    if(signedInUser==null){await LocalStore.instance.saveAddress(address);return;}
    await AuthService.instance.saveServerAddress({...address.toRow(),if(address.id!=null)'id':address.id});
  }
  bool syncingCustomerData=false;
  Future<List<RecentItem>> loadPreviouslyOrderedFromHistory() async {
    final orderRows=<dynamic>[];
    for(var page=1;page<=5;page++){
      final response=await AuthService.instance.myOrders(page:page);
      orderRows.addAll(response['orders'] as List<dynamic>? ?? []);
      final items=RecentOrderItems.fromOrderHistory(orderRows);
      if(items.length>=20||response['hasMore']!=true)return items;
    }
    return RecentOrderItems.fromOrderHistory(orderRows);
  }

  Future<void> syncCustomerData() async {
    final user=AuthService.instance.user;
    if(user==null||syncingCustomerData)return;
    syncingCustomerData=true;
    if(mounted)setState((){
      recentItemsLoading=true;
      recentItemsError=null;
    });
    try {
      // Load orders BEFORE optional address migration. Migration failures must
      // never suppress or delay the previously ordered products.
      List<RecentItem> items=[];
      try{
        final response=await AuthService.instance.customerData();
        items=RecentOrderItems.fromCustomerData(response['items']);
      }catch(_){
        // The full customer order ledger is an independent, authenticated API.
      }
      if(items.isEmpty)items=await loadPreviouslyOrderedFromHistory();
      if(!mounted||AuthService.instance.user?.id!=user.id)return;
      setState((){
        recentItems=items;
        recentItemsError=null;
      });
    }catch(_){
      if(mounted&&AuthService.instance.user?.id==user.id){
        setState(()=>recentItemsError=tr('Could not load previous orders. Tap retry.',
            'पहले के ऑर्डर नहीं खुल सके। फिर से प्रयास करें।'));
      }
    }finally{
      syncingCustomerData=false;
      if(mounted)setState(()=>recentItemsLoading=false);
    }
    // Address migration is independent; do not block order history on it.
    try{
      final prefs=await SharedPreferences.getInstance();
      final migrationKey='server-address-migration-${user.id}';
      if(prefs.getBool(migrationKey)!=true){
        for(final address in await LocalStore.instance.loadAddresses()){
          if(AuthService.instance.user?.id!=user.id)return;
          await AuthService.instance.saveServerAddress(address.toRow());
        }
        await prefs.setBool(migrationKey,true);
      }
    }catch(_){/* Saved addresses can be retried independently. */}
  }
  Future<void> checkNotifications() async {
    final account=AuthService.instance.user;
    if(account==null){notificationFeed.value=[];shownNotifications.clear();notificationUserId=null;notificationsPrimed=false;return;}
    if(checkingNotifications || WidgetsBinding.instance.lifecycleState!=AppLifecycleState.resumed)return;
    checkingNotifications=true;
    await syncCustomerData();
    if(notificationUserId!=account.id){shownNotifications.clear();notificationUserId=account.id;notificationsPrimed=false;}
    try {
      final feeds=await Future.wait([
        AuthService.instance.orderNotifications().catchError((Object _) => <String,dynamic>{}),
        AuthService.instance.deliveryRequest().catchError((Object _) => <String,dynamic>{}),
      ]);
      if(feeds.every((feed)=>feed.isEmpty))return;
      final orders=feeds[0], deliveries=feeds[1];
      if(!mounted || AuthService.instance.user?.id!=account.id)return;
      final fresh=<String>[];
      final freshNotices=<Map<String,dynamic>>[];
      final feed=<Map<String,dynamic>>[];
      for(final entry in {'order':orders,'delivery':deliveries}.entries){
        for(final raw in entry.value['notifications'] as List<dynamic>? ?? []){
          feed.add({...Map<String,dynamic>.from(raw as Map),'_audience':entry.key});
          final key='${entry.key}:${raw['id']}';
          if(raw['read_at']==null && !shownNotifications.contains(key)){
            fresh.add(raw['message'] as String? ?? 'Order update');
            freshNotices.add({...Map<String,dynamic>.from(raw),'_audience':entry.key});
          }
          shownNotifications.add(key);
        }
      }
      feed.sort((a,b)=>(b['created_at']?.toString() ?? '').compareTo(a['created_at']?.toString() ?? ''));
      notificationFeed.value=feed;
      if(notificationsPrimed&&freshNotices.isNotEmpty)unawaited(MandiNoticeSettings.instance.notify('customer',freshNotices));
      notificationsPrimed=true;
      if(fresh.isNotEmpty)ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        duration:const Duration(seconds:20),content:Text(tr('${fresh.length} new notification(s): ${fresh.first}','${fresh.length} नई सूचना: ${fresh.first}'))));
    }catch(_){/* Retry automatically at the next check without a password prompt. */}
    finally{checkingNotifications=false;}
  }

  Future<void> restoreAccount() async {
    try {
      final account = await AuthService.instance.restore();
      if (mounted) {
        setState(() {
          signedInUser=account;
          if(account!=null)recentItems=[];
        });
        checkNotifications();
        syncCustomerData();
      }
    } catch (_) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(tr('Could not restore your account. Sign in again.','आपका खाता पुनः लोड नहीं हो सका। फिर से साइन इन करें।'))));
    }
  }

  void showMarket() {
    FocusScope.of(context).unfocus();
    _searchController.clear();
    setState(() {
      category = 'All';
      query = '';
      favoritesOnly = false;
      marketResetSerial++;
    });
  }

  Future<void> openOrders() async {
    if (signedInUser == null || AuthService.instance.user == null) await openAccount();
    if (!mounted || signedInUser == null || AuthService.instance.user == null) return;
    await Navigator.of(context).push(MaterialPageRoute<void>(
      builder: (_) => const MyOrdersPage(),
    ));
    if (mounted) showMarket();
  }

  Future<void> changeCustomerPassword() async {
    final current=TextEditingController(),next=TextEditingController(),confirm=TextEditingController();
    try{
      final values=await showDialog<List<String>>(context:context,builder:(ctx)=>AlertDialog(
        title:customerDialogTitle(ctx,tr('Change password','पासवर्ड बदलें')),
        content:SingleChildScrollView(child:Column(mainAxisSize:MainAxisSize.min,children:[
          TextField(controller:current,obscureText:true,decoration:InputDecoration(labelText:tr('Current password','पुराना पासवर्ड'))),
          TextField(controller:next,obscureText:true,decoration:InputDecoration(labelText:tr('New password','नया पासवर्ड'))),
          TextField(controller:confirm,obscureText:true,decoration:InputDecoration(labelText:tr('Confirm password','पासवर्ड की पुष्टि करें'))),
        ])),
        actions:[TextButton(onPressed:()=>Navigator.pop(ctx),child:Text(tr('Cancel','रद्द करें'))),
          FilledButton(onPressed:()=>Navigator.pop(ctx,[current.text,next.text,confirm.text]),child:Text(tr('Change password','बदलें')))],
      ));
      if(values==null||!mounted)return;
      await AuthService.instance.changePassword(currentPassword:values[0],newPassword:values[1],confirmation:values[2]);
      if(!mounted)return;
      setState(()=>signedInUser=null);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content:Text(tr('Password changed. Sign in again.','पासवर्ड बदल गया। फिर से लॉग इन करें।'))));
    }on AuthException catch(error){if(mounted)ScaffoldMessenger.of(context).showSnackBar(SnackBar(content:Text(localizeError(error.message))));}
    finally{current.dispose();next.dispose();confirm.dispose();}
  }

  Future<void> linkCustomerGoogle() async {
    try{
      final id=await AuthService.instance.googleClientId();
      if(id==null)throw const AuthException('Google sign-in is not configured.');
      final account=await CustomerGoogleSignIn.authenticate(id);
      final token=account.authentication.idToken;
      if(token==null)throw const AuthException('Google token unavailable.');
      await AuthService.instance.linkGoogle(token);
      if(mounted)ScaffoldMessenger.of(context).showSnackBar(SnackBar(content:Text(tr('Google account linked.','Google खाता जोड़ दिया गया।'))));
    }on Exception catch(error){
      if(mounted)ScaffoldMessenger.of(context).showSnackBar(SnackBar(content:Text(
        error is GoogleSignInException ? CustomerGoogleSignIn.safeFailure(error)
        : error is AuthException ? localizeError(error.message)
        : tr('Could not link Google.','Google खाता नहीं जुड़ा।'))));
    }
  }

  Future<void> openAccount() async {
    if (signedInUser == null) {
      final account = await Navigator.push<AuthUser>(context,
        MaterialPageRoute(builder: (_) => const AccountPage()));
      if (mounted && account != null) {
        setState(() {signedInUser=account;recentItems=[];});
        checkNotifications();
        syncCustomerData();
      }
      return;
    }
    final account = signedInUser!;
    await showDialog<void>(context: context, builder: (dialogContext) => AlertDialog(
      title: customerDialogTitle(dialogContext,tr('My account','मेरा खाता')),
      content: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start,
        children: [Text(account.name), Text('+91 ${account.mobile}'),
          if (account.email != null && account.email!.isNotEmpty) Text(account.email!),
          const SizedBox(height: 12),
          Text(tr('Signing out clears this device. Addresses saved to your account remain available when you sign in again.','साइन आउट करने पर इस डिवाइस का स्थानीय डेटा साफ होगा। खाते में सहेजे पते अगली बार साइन इन करने पर उपलब्ध रहेंगे।'))]),
      actions: [
        TextButton(onPressed: () async {
          Navigator.pop(dialogContext);
          if(mounted)await Navigator.push(context,MaterialPageRoute<void>(
            builder:(_)=>const MyOrdersPage()));
        },child:Text(tr('My orders','मेरे ऑर्डर'))),
        TextButton(onPressed: () async {Navigator.pop(dialogContext);await showNotificationModal();},
          child:Text(tr('Notifications','सूचनाएँ'))),
        TextButton(onPressed: () async {
          Navigator.pop(dialogContext);
          if(mounted)await Navigator.push(context,MaterialPageRoute<void>(builder:(_)=>MandiNotificationSettingsPage(role:'customer',hindi:EasyMandiLanguage.hindi.value)));
        },child:Text(tr('Notification settings','सूचना सेटिंग्स'))),
        TextButton(onPressed: () async {Navigator.pop(dialogContext);await changeCustomerPassword();},
          child:Text(tr('Change password','पासवर्ड बदलें'))),
        TextButton(onPressed: () async {Navigator.pop(dialogContext);await linkCustomerGoogle();},
          child:Text(tr('Link Google','Google खाता जोड़ें'))),
        TextButton(onPressed: () async {Navigator.pop(dialogContext);await openPrivacyPolicy();},
          child:Text(tr('Privacy policy','गोपनीयता नीति'))),
        TextButton(onPressed: () async {Navigator.pop(dialogContext);await openAccountDeletionPage();},
          child:Text(tr('Request account deletion','खाता हटाने का अनुरोध'))),
        TextButton(onPressed: () => Navigator.pop(dialogContext), child: Text(tr('Close','बंद करें'))),
        FilledButton(onPressed: () async {
          Navigator.pop(dialogContext);
          try {
            await _cartWrite;
            await LocalStore.instance.clearPersonalData();
            await AuthService.instance.logout();
            if (!mounted) return;
            setState(() { signedInUser = null; notificationFeed.value=[]; cart.clear(); recentItems = []; });
            ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(tr('Signed out.','साइन आउट हो गया।'))));
          } catch (_) {
            if (mounted) ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text(tr('Could not clear account data. Please try again.','खाते का डेटा साफ नहीं हो सका। कृपया फिर प्रयास करें।'))));
          }
        }, child: Text(tr('Sign out','साइन आउट'))),
      ],
    ));
  }

  Future<void> loadPopularProducts() async {
    final client=HttpClient()..connectionTimeout=const Duration(seconds:8);
    try{
      final request=await client.getUrl(Uri.parse('https://cserver.learnwithchampak.live/easymandi/api/popular-products.php'));
      final response=await request.close().timeout(const Duration(seconds:8));
      if(response.statusCode!=200)return;
      final data=jsonDecode(await response.transform(utf8.decoder).join()) as Map<String,dynamic>;
      final entries=data['products'] as List<dynamic>? ?? [];
      if(mounted)setState(()=>popularProductIds=entries.map((p)=>'${p['id']}').toList());
    }catch(_){ /* Browsing still works without rankings. */ }
    finally{client.close(force:true);}
  }

  Future<void> loadCatalog() async {
    if (mounted) setState(() => loading = true);
    String? raw;
    try {
      final client = HttpClient()..connectionTimeout = const Duration(seconds: 8);
      try {
        final request = await client.getUrl(Uri.parse(catalogUrl));
        final response = await request.close().timeout(const Duration(seconds: 8));
        if (response.statusCode != 200) throw const HttpException('Catalog unavailable');
        raw = await response.transform(utf8.decoder).join();
      } finally {
        client.close(force: true);
      }
    } catch (_) {
      raw = await rootBundle.loadString('assets/products.json');
    }
    try {
      final data = jsonDecode(raw) as Map<String, dynamic>;
      final parsed = (data['products'] as List).map((e) => Product(e as Map<String, dynamic>)).toList();
      await _cartWrite;
      final saved = await LocalStore.instance.loadCart();
      final recent = await LocalStore.instance.loadRecentItems();
      if (!mounted) return;
      setState(() {
        products = parsed;
        if(AuthService.instance.user==null)recentItems = recent;
        store = data['store'] as Map<String, dynamic>;
        checkoutRules = data['checkout'] as Map<String, dynamic>? ?? {};
        categories = (data['categories'] as List).cast<String>();
        cart.clear();
        for (final e in saved.entries) {
          if (parsed.any((p) => p.id == e.key && p.available) && e.value > 0) {
            cart[e.key] = e.value.clamp(1, 99);
          }
        }
        loading = false;
        message = '';
      });
      await syncCustomerData();
    } catch (_) {
      if (mounted) setState(() { loading = false; message = tr('Could not load the catalog. Please try again.','कैटलॉग लोड नहीं हो सका। कृपया फिर प्रयास करें।'); });
    }
  }

  void changeQuantity(Product p, int difference) {
    setState(() {
      final next = ((cart[p.id] ?? 0) + difference).clamp(0, 99);
      if (next == 0) { cart.remove(p.id); } else { cart[p.id] = next; }
    });
    final quantity = cart[p.id] ?? 0;
    _cartWrite = _cartWrite.then((_) => LocalStore.instance.setQuantity(p.id, quantity)).catchError((Object error) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(tr('Could not save the basket on this device.','इस डिवाइस पर टोकरी सहेजी नहीं जा सकी।'))));
    });
  }

  int get count => cart.values.fold(0, (a, b) => a + b);
  num get subtotal => products.fold<num>(0, (sum,p)=>sum + p.lineTotal(cart[p.id]??0));
  num get mandiSavings => products.fold<num>(0,(sum,p)=>sum+p.mandiSavings(cart[p.id]??0));
  num get fee => subtotal == 0 || subtotal >= (store['freeDeliveryAbove'] as num? ?? 499) ? 0 : (store['deliveryFee'] as num? ?? 30);
  String money(num amount) => formatMoney(amount);

  Future<void> showUpiPayment({
    required String orderId,
    required num total,
    required String requestKey,
  }) async {
    Map<String,dynamic> payment;
    try {
      payment = await AuthService.instance.paymentStatus(orderId: orderId, requestKey: requestKey);
    } on AuthException catch (error) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(localizeError(error.message))));
      return;
    }
    if (!mounted) return;
    final reference = TextEditingController();
    XFile? receipt;
    String receiptStatus = tr('Upload a JPG, PNG or WebP payment screenshot under 1 MB.','1 MB से कम JPG, PNG या WebP भुगतान स्क्रीनशॉट अपलोड करें।');
    bool uploading = false;
    await showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) => StatefulBuilder(builder: (dialogContext, updateDialog) => AlertDialog(
        title: customerDialogTitle(dialogContext,tr('UPI payment · $orderId','UPI भुगतान · $orderId'),canClose: !uploading),
        content: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: [
          Text(tr('Pay exactly ${money(total)}','ठीक ${money(total)} भुगतान करें'), style: Theme.of(dialogContext).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold)),
          const SizedBox(height: 10),
          Text('${payment['payeeName']}'),
          SelectableText('${payment['upiId']}', style: const TextStyle(fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),
          QrImageView(data: payment['upiUri'] as String, size: 220),
          // Payment is made using the QR in a separate UPI app.
          // No deep-link launcher: customers can stay on this receipt screen.
          const SizedBox(height: 14),
          TextField(controller: reference, maxLength: 80, decoration: InputDecoration(labelText: tr('UPI transaction/reference (optional)','UPI ट्रांज़ैक्शन/रेफरेंस (वैकल्पिक)'))),
          OutlinedButton.icon(
            onPressed: uploading ? null : () async {
              final picked=await ImagePicker().pickImage(source: ImageSource.gallery, imageQuality: 92);
              if(picked==null)return;
              final length=await picked.length();
              if(length>1048576){
                updateDialog(()=>receiptStatus=tr('Receipt must be smaller than 1 MB.','रसीद 1 MB से छोटी होनी चाहिए।'));
                return;
              }
              updateDialog((){receipt=picked;receiptStatus=tr('Receipt selected: ${picked.name}','रसीद चुनी गई: ${picked.name}');});
            },
            icon: const Icon(Icons.receipt_long_outlined),
            label: Text(receipt==null?tr('Choose payment screenshot','भुगतान स्क्रीनशॉट चुनें'):tr('Change screenshot','स्क्रीनशॉट बदलें')),
          ),
          Text(receiptStatus, style: Theme.of(dialogContext).textTheme.bodySmall),
        ])),
        actions: [
          TextButton(onPressed: uploading ? null : () => Navigator.pop(dialogContext), child: Text(tr('Upload later','बाद में अपलोड करें'))),
          FilledButton(
            onPressed: uploading || receipt==null ? null : () async {
              updateDialog(()=>uploading=true);
              try {
                final bytes=await receipt!.readAsBytes();
                var mime=receipt!.mimeType ?? '';
                if(mime.isEmpty){
                  final lower=receipt!.name.toLowerCase();
                  mime=lower.endsWith('.png')?'image/png':lower.endsWith('.webp')?'image/webp':'image/jpeg';
                }
                await AuthService.instance.submitPaymentReceipt(
                  orderId: orderId, requestKey: requestKey, upiReference: reference.text,
                  receiptMime: mime, receiptBase64: base64Encode(bytes),
                );
                if(dialogContext.mounted) Navigator.pop(dialogContext);
                if(mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(tr('Payment receipt submitted for verification.','भुगतान रसीद सत्यापन के लिए भेज दी गई है।'))));
              } on AuthException catch(error) {
                updateDialog((){uploading=false;receiptStatus=localizeError(error.message);});
              } catch (_) {
                updateDialog((){uploading=false;receiptStatus=tr('Could not upload the receipt. Please try again.','रसीद अपलोड नहीं हो सकी। कृपया फिर प्रयास करें।');});
              }
            },
            child: Text(uploading?tr('Uploading…','अपलोड हो रहा है…'):tr('Submit receipt','रसीद भेजें')),
          ),
        ],
      )),
    );
    reference.dispose();
  }

  Future<void> checkout() async {
    // Catalogue browsing is public, but no guest may submit an order.
    if (AuthService.instance.user == null) {
      if (signedInUser != null && mounted) setState(() => signedInUser = null);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(tr(
        'Sign in or register to place your order. Your basket will be kept.',
        'ऑर्डर करने के लिए लॉग इन या रजिस्टर करें। आपकी टोकरी सुरक्षित रहेगी।'))));
      await openAccount();
      if (mounted && signedInUser != null && AuthService.instance.user != null) {
        await checkout();
      }
      return;
    }
    final minimum = (store['minimumOrder'] as num? ?? 99);
    if (subtotal < minimum) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(tr('Minimum order is ${money(minimum)}. Add ${money(minimum - subtotal)} more.','न्यूनतम ऑर्डर ${money(minimum)} है। ${money(minimum - subtotal)} और जोड़ें।'))));
      return;
    }
    // Server-authoritative Varanasi service areas; never permit free-text
    // fallback when the endpoint is unavailable.
    late final List<Map<String,dynamic>> serviceAreas;
    try {
      final client=HttpClient()..connectionTimeout=const Duration(seconds: 8);
      try {
        final request=await client.getUrl(Uri.parse(
          'https://cserver.learnwithchampak.live/easymandi/api/localities.php'));
        final response=await request.close().timeout(const Duration(seconds: 8));
        if(response.statusCode!=200)throw const HttpException('Service areas unavailable');
        final body=jsonDecode(await response.transform(utf8.decoder).join()) as Map<String,dynamic>;
        serviceAreas=(body['localities'] as List).map((e)=>Map<String,dynamic>.from(e as Map)).toList();
        if(serviceAreas.isEmpty)throw const FormatException('No localities enabled');
      } finally { client.close(force:true); }
    }catch(_){
      if(mounted)ScaffoldMessenger.of(context).showSnackBar(SnackBar(content:Text(tr(
        'Could not load serviced Varanasi localities. Please retry.',
        'वाराणसी के डिलीवरी क्षेत्र लोड नहीं हुए। कृपया पुनः प्रयास करें।'))));
      return;
    }
    final name = TextEditingController(text: AuthService.instance.user!.name);
    final phone = TextEditingController(text: AuthService.instance.user!.mobile);
    final house = TextEditingController();
    final locality = TextEditingController();
    final landmark = TextEditingController();
    final pin = TextEditingController();
    final instructions = TextEditingController();
    final countryCode = checkoutRules['countryCode'] as String? ?? '+91';
    final mobilePattern = RegExp(checkoutRules['mobilePattern'] as String? ?? r'^[6-9][0-9]{9}$');
    final pinPattern = RegExp(checkoutRules['pinPattern'] as String? ?? r'^[1-9][0-9]{5}$');
    final city = store['city'] as String? ?? 'Varanasi';
    final state = checkoutRules['state'] as String? ?? 'Uttar Pradesh';
    final form = GlobalKey<FormState>();
    List<SavedAddress> savedAddresses;
    try {
      savedAddresses = signedInUser==null ? await LocalStore.instance.loadAddresses() : ((await AuthService.instance.customerData())['addresses'] as List).map((row)=>SavedAddress.fromRow(Map<String,Object?>.from(row as Map))).toList();
    } catch (_) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(tr('Saved addresses are unavailable on this device.','सहेजे गए पते इस डिवाइस पर उपलब्ध नहीं हैं।'))));
      savedAddresses=[];
    }
    if (!mounted) return;
    SavedAddress? selectedAddress;
    Position? deliveryPosition;
    bool saveNewAddress = true;
    String paymentMethod = 'cod';
    final submitted = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(builder: (dialogContext, updateDialog) => AlertDialog(
        title: customerDialogTitle(dialogContext,tr('Place order','ऑर्डर करें')),
        content: Form(
          key: form,
          child: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: [
            Text(tr('Your order will be saved for the Easy Mandi team. You can also send its reference by WhatsApp. Confirm final price and delivery before payment.','आपका ऑर्डर Easy Mandi टीम के लिए सहेजा जाएगा। आप इसका रेफरेंस WhatsApp पर भी भेज सकते हैं। भुगतान से पहले अंतिम कीमत और डिलीवरी की पुष्टि करें।')),
            const SizedBox(height: 16),
            // Locality MUST be selected before entering the detailed address.
            DropdownButtonFormField<String>(
              key: ValueKey('service-locality-${locality.text}'),
              initialValue: serviceAreas.any((a)=>a['name']==locality.text) ? locality.text : null,
              isExpanded:true,
              decoration:InputDecoration(labelText:tr('Select delivery locality','डिलीवरी क्षेत्र चुनें')),
              items:serviceAreas.map((a)=>DropdownMenuItem<String>(
                value:a['name'] as String,
                child:Text(a['name'] as String,overflow:TextOverflow.ellipsis))).toList(),
              onChanged:(value)=>updateDialog(()=>locality.text=value??''),
              validator:(value)=>value!=null&&serviceAreas.any((a)=>a['name']==value)
                ? null : tr('Choose an available Varanasi locality','वाराणसी का उपलब्ध क्षेत्र चुनें'),
            ),
            const SizedBox(height: 7),
            OutlinedButton.icon(
              onPressed:locality.text.isEmpty?null:() async{
                final matches=serviceAreas.where((a)=>a['name']==locality.text);
                if(matches.isEmpty)return;
                final query=(matches.first['mapQuery'] as String?)??'${locality.text}, Varanasi, India';
                final url=Uri.https('www.google.com','/maps/search/',{'api':'1','query':query});
                if(!await launchUrl(url,mode:LaunchMode.externalApplication)&&dialogContext.mounted){
                  ScaffoldMessenger.of(dialogContext).showSnackBar(SnackBar(content:Text(tr(
                    'Could not display this locality on the map.','मानचित्र पर क्षेत्र नहीं खुल सका।'))));
                }
              },
              icon:const Icon(Icons.map_outlined),
              label:Text(tr('Display locality on map','मानचित्र पर क्षेत्र दिखाएँ'))),
            const SizedBox(height: 12),
            if (savedAddresses.isNotEmpty) DropdownButtonFormField<int?>(
              key: ValueKey(selectedAddress?.id),
              initialValue: selectedAddress?.id,
              decoration: InputDecoration(labelText: tr('Delivery address','डिलीवरी पता')),
              items: [DropdownMenuItem<int?>(value: null, child: Text(tr('Use a new address','नया पता इस्तेमाल करें'))),
                ...savedAddresses.map((a) => DropdownMenuItem<int?>(value: a.id, child: Text('${a.house}, ${a.locality} • ${a.pin}', overflow: TextOverflow.ellipsis)))],
              onChanged: (id) => updateDialog(() {
                selectedAddress = id == null ? null : savedAddresses.firstWhere((a) => a.id == id);
                final a = selectedAddress;
                name.text = a?.name ?? AuthService.instance.user!.name;
                phone.text = AuthService.instance.user!.mobile;
                house.text = a?.house ?? ''; locality.text = a?.locality ?? '';
                landmark.text = a?.landmark ?? ''; pin.text = a?.pin ?? '';
              }),
            ),
            if (savedAddresses.isNotEmpty) const SizedBox(height: 10),
            TextFormField(controller: name, decoration: InputDecoration(labelText: tr('Your name','आपका नाम')), textCapitalization: TextCapitalization.words, validator: (v) => v == null || v.trim().length < 2 ? tr('Enter your name','अपना नाम दर्ज करें') : null),
            const SizedBox(height: 10),
            TextFormField(
              controller: phone,
              readOnly: true,
              decoration: InputDecoration(labelText: tr('Registered mobile number','पंजीकृत मोबाइल नंबर'), prefixText: '$countryCode ', hintText: checkoutRules['mobileExample'] as String? ?? '9876543210', helperText: tr('Orders use your signed-in account number.','ऑर्डर आपके लॉग इन खाते के नंबर से होंगे।')),
              keyboardType: TextInputType.phone,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(10)],
              validator: (v) => mobilePattern.hasMatch(v?.trim() ?? '') ? null : tr('Enter a valid 10-digit Indian mobile number','मान्य 10 अंकों का भारतीय मोबाइल नंबर दर्ज करें'),
            ),
            const SizedBox(height: 10),
            TextFormField(controller: house, decoration: InputDecoration(labelText: tr('House / flat / building','मकान / फ्लैट / बिल्डिंग'), hintText: tr('House 12','मकान 12')), textCapitalization: TextCapitalization.words, validator: (v) => (v?.trim().length ?? 0) >= 2 && RegExp(r'[A-Za-z0-9\u0900-\u097F]').hasMatch(v!.trim()) ? null : tr('Enter a house or building number/name','मकान या बिल्डिंग का नंबर/नाम दर्ज करें')),
            const SizedBox(height: 10),
            TextFormField(controller: landmark, decoration: InputDecoration(labelText: tr('Landmark (optional)','लैंडमार्क (वैकल्पिक)')), textCapitalization: TextCapitalization.words),
            const SizedBox(height: 10),
            TextFormField(
              controller: pin,
              decoration: InputDecoration(labelText: tr('PIN code','पिन कोड'), hintText: checkoutRules['pinExample'] as String? ?? '221005', helperText: tr('6-digit Indian PIN code','6 अंकों का भारतीय पिन कोड')),
              keyboardType: TextInputType.number,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(6)],
              validator: (v) => pinPattern.hasMatch(v?.trim() ?? '') ? null : tr('Enter a valid 6-digit PIN code','मान्य 6 अंकों का पिन कोड दर्ज करें'),
            ),
            const SizedBox(height: 10),
            OutlinedButton.icon(onPressed: () async {
              try {
                var permission = await Geolocator.checkPermission();
                if (permission == LocationPermission.denied) permission = await Geolocator.requestPermission();
                if (permission == LocationPermission.denied || permission == LocationPermission.deniedForever) {
                  throw Exception('Location permission denied');
                }
                final position = await Geolocator.getCurrentPosition(
                  locationSettings: const LocationSettings(accuracy: LocationAccuracy.high,
                    timeLimit: Duration(seconds: 15)));
                updateDialog(() => deliveryPosition = position);
              } catch (_) {
                if (dialogContext.mounted) ScaffoldMessenger.of(dialogContext).showSnackBar(
                  SnackBar(content: Text(tr('Location unavailable. You can still use the written address.','लोकेशन उपलब्ध नहीं है। आप लिखित पता इस्तेमाल कर सकते हैं।'))));
              }
            }, icon: const Icon(Icons.my_location), label: Text(deliveryPosition == null
              ? tr('Share current location (optional)','वर्तमान लोकेशन साझा करें (वैकल्पिक)') : tr('Location attached · update pin','लोकेशन जुड़ी है · पिन अपडेट करें'))),
            if (deliveryPosition != null) Text(tr('Map pin: ${deliveryPosition!.latitude.toStringAsFixed(5)}, ${deliveryPosition!.longitude.toStringAsFixed(5)}','मैप पिन: ${deliveryPosition!.latitude.toStringAsFixed(5)}, ${deliveryPosition!.longitude.toStringAsFixed(5)}')),
            Text(tr('Delivery city: $city, $state','डिलीवरी शहर: $city, $state'), style: Theme.of(dialogContext).textTheme.bodySmall),
            const SizedBox(height: 12),
            TextFormField(
              controller: instructions,
              maxLength: 500,
              maxLines: 2,
              decoration: InputDecoration(labelText: tr('Delivery instructions (optional)','डिलीवरी निर्देश (वैकल्पिक)')),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: paymentMethod,
              decoration: InputDecoration(labelText: tr('Payment method','भुगतान का तरीका')),
              items: [
                DropdownMenuItem(value: 'cod', child: Text(tr('Cash on Delivery','कैश ऑन डिलीवरी'))),
                DropdownMenuItem(value: 'upi', child: Text(tr('UPI / QR payment','UPI / QR भुगतान'))),
              ],
              onChanged: (value) => updateDialog(() => paymentMethod = value ?? 'cod'),
            ),
            if (paymentMethod == 'upi') Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(tr('After placing the order, pay the exact saved total by UPI and upload the payment screenshot for admin verification.','ऑर्डर करने के बाद सहेजी गई सही राशि UPI से भुगतान करें और एडमिन सत्यापन के लिए भुगतान स्क्रीनशॉट अपलोड करें।')),
            ),
            if (selectedAddress == null) CheckboxListTile(
              contentPadding: EdgeInsets.zero, title: Text(signedInUser==null?tr('Save this address on this device','यह पता इस डिवाइस पर सहेजें'):tr('Save address to my account (all devices)','यह पता मेरे खाते में सहेजें (सभी डिवाइस)')),
              value: saveNewAddress, onChanged: (value) => updateDialog(() => saveNewAddress = value ?? false),
            ),
            if (selectedAddress != null) TextButton.icon(
              onPressed: () async {
                try {if(signedInUser==null)await LocalStore.instance.deleteAddress(selectedAddress!.id!);else await AuthService.instance.deleteServerAddress(selectedAddress!.id!);}catch(_){if(dialogContext.mounted)ScaffoldMessenger.of(dialogContext).showSnackBar(SnackBar(content:Text(tr('Could not delete address. Please retry.','पता हटाया नहीं जा सका। कृपया फिर प्रयास करें।'))));return;}
                if (!dialogContext.mounted) return;
                updateDialog(() {
                  savedAddresses.removeWhere((a) => a.id == selectedAddress!.id);
                  selectedAddress = null;
                  name.clear(); phone.clear(); house.clear(); locality.clear(); landmark.clear(); pin.clear();
                });
              }, icon: const Icon(Icons.delete_outline), label: Text(tr('Delete saved address','सहेजा पता हटाएँ')),
            ),
          ])),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogContext, false), child: Text(tr('Cancel','रद्द करें'))),
          FilledButton(onPressed: () { if (form.currentState!.validate()) Navigator.pop(dialogContext, true); }, child: Text(tr('Place order','ऑर्डर करें'))),
        ],
      )),
    );
    if (submitted != true || !mounted) return;
    if(!serviceAreas.any((a)=>a['name']==locality.text)){
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content:Text(tr(
        'This locality is not currently served. Choose an available area.',
        'यह क्षेत्र अभी सेवा में नहीं है। उपलब्ध क्षेत्र चुनें।'))));
      return;
    }
    if (saveNewAddress && selectedAddress == null) {
      try {
        await saveCustomerAddress(SavedAddress(name: name.text.trim(), phone: phone.text.trim(),
          house: house.text.trim(), locality: locality.text.trim(), landmark: landmark.text.trim(), pin: pin.text.trim()));
      } catch (_) {
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(tr('Address could not be saved; the enquiry can still be sent.','पता सहेजा नहीं जा सका; ऑर्डर फिर भी भेजा जा सकता है।'))));
      }
    } else if (selectedAddress != null) {
      try {
        await saveCustomerAddress(SavedAddress(id: selectedAddress!.id, name: name.text.trim(), phone: phone.text.trim(),
          house: house.text.trim(), locality: locality.text.trim(), landmark: landmark.text.trim(), pin: pin.text.trim()));
      } catch (_) {
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(tr('Address changes could not be saved.','पते के बदलाव सहेजे नहीं जा सके।'))));
      }
    }
    final orderItems = [
      for (final p in products)
        if (cart.containsKey(p.id)) {'id': p.id, 'quantity': cart[p.id]!},
    ];
    _pendingOrderKey ??= List<int>.generate(16, (_) => Random.secure().nextInt(256))
        .map((byte) => byte.toRadixString(16).padLeft(2, '0')).join();
    Map<String, dynamic> savedOrder;
    late String orderAccessKey;
    try {
      orderAccessKey = _pendingOrderKey!;
      savedOrder = await AuthService.instance.createOrder({
        'requestKey': _pendingOrderKey,
        'source': 'android',
        'paymentMethod': paymentMethod,
        'customerNote': instructions.text.trim(),
        'name': name.text.trim(),
        'mobile': phone.text.trim(),
        'house': house.text.trim(),
        'locality': locality.text.trim(),
        'landmark': landmark.text.trim(),
        'pin': pin.text.trim(),
        if (deliveryPosition != null) 'locationLat': deliveryPosition!.latitude,
        if (deliveryPosition != null) 'locationLng': deliveryPosition!.longitude,
        'items': orderItems,
      });
      _pendingOrderKey = null;
     } on AuthException catch (error) {
      if(error.statusCode==409&&error.message.startsWith('Order request already used'))_pendingOrderKey=null;
      if (mounted) {
        if (error.statusCode == 401) setState(() => signedInUser = null);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(localizeError(error.message))));
      }
      return;
    }
    if (!mounted) return;
    final orderId = savedOrder['orderId'] as String;
    final savedTotal = savedOrder['total'] as num;
    final lines = products.where((p) => cart.containsKey(p.id))
        .map((p) => '• ${productName(p.name,p.hindi)} (${p.unit}) × ${cart[p.id]}').join('\n');
    final address = [house.text.trim(), locality.text.trim(),
      if (landmark.text.trim().isNotEmpty) 'Near ${landmark.text.trim()}',
      '$city, $state - ${pin.text.trim()}'].join(', ');
    final body = tr(
      'Hello Easy Mandi, my order $orderId has been placed.\n\n$lines'
      '\n\nTotal: ${money(savedTotal)}\nName: ${name.text.trim()}'
      '\nMobile: $countryCode ${phone.text.trim()}\nAddress: $address'
      '\nPayment: ${paymentMethod == 'upi' ? 'UPI selected' : 'Cash on Delivery'}'
      '\n\nPlease confirm availability and delivery time.',
      'नमस्ते Easy Mandi, मेरा ऑर्डर $orderId कर दिया गया है।\n\n$lines'
      '\n\nकुल: ${money(savedTotal)}\nनाम: ${name.text.trim()}'
      '\nमोबाइल: $countryCode ${phone.text.trim()}\nपता: $address'
      '\nभुगतान: ${paymentMethod == 'upi' ? 'UPI चुना गया' : 'कैश ऑन डिलीवरी'}'
      '\n\nकृपया उपलब्धता और डिलीवरी समय की पुष्टि करें।'
    );
    try {
      final now = DateTime.now().millisecondsSinceEpoch;
      await LocalStore.instance.recordRecentItems([
        for (final p in products)
          if (cart.containsKey(p.id))
            RecentItem(productId: p.id, name: p.name, unit: p.unit, emoji: p.emoji,
              quantity: cart[p.id]!, requestedAt: now),
      ]);
      final recent = await LocalStore.instance.loadRecentItems();
      if (mounted) setState(() => recentItems = recent);
      await syncCustomerData();
    } catch (_) {
      // Server order is already saved; recent items remain optional device data.
    }
    if (paymentMethod == 'upi') {
      await showUpiPayment(orderId: orderId, total: savedTotal, requestKey: orderAccessKey);
      if (!mounted) return;
    }
    final shareReference = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: customerDialogTitle(ctx,tr('Order received · $orderId','ऑर्डर दर्ज हुआ · $orderId')),
        content: Column(mainAxisSize: MainAxisSize.min,crossAxisAlignment: CrossAxisAlignment.start,children:[
          Text(tr('Saved total: ${money(savedTotal)}','सहेजी गई कुल राशि: ${money(savedTotal)}')),
          const SizedBox(height: 8),
          Text(paymentMethod=='cod'
            ?tr('Cash on Delivery selected. Your order is saved; delivery time and stock confirmation are pending.',
                'डिलीवरी पर नकद चुना गया। ऑर्डर दर्ज है, उपलब्धता व समय की पुष्टि बाकी है।')
            :tr('UPI order saved. Payment requires receipt verification.','UPI ऑर्डर दर्ज है। रसीद का सत्यापन आवश्यक है।')),
        ]),
        actions:[
          TextButton(onPressed:()=>Navigator.pop(ctx,false),child:Text(tr('Done','ठीक है'))),
          FilledButton(onPressed:()=>Navigator.pop(ctx,true),child:Text(tr('Share on WhatsApp','व्हाट्सऐप पर साझा करें'))),
        ],
      ),
    );
    if(!mounted)return;
    if(shareReference!=true){
      for(final id in cart.keys.toList()){
        _cartWrite=_cartWrite.then((_)=>LocalStore.instance.setQuantity(id,0));
      }
      if(mounted)setState(cart.clear);
      return;
    }
    final uri = whatsappOrderUri(store['supportPhone'] as String? ?? '', body);
    var opened = false;
    try { opened = await launchUrl(uri, mode: LaunchMode.externalApplication); } catch (_) { /* Preserve saved order and copy its reference below. */ }
    if (!opened) {
      await Clipboard.setData(ClipboardData(text: body));
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(tr('Order $orderId saved. WhatsApp could not open; reference copied.','ऑर्डर $orderId सहेजा गया। WhatsApp नहीं खुला; रेफरेंस कॉपी कर दिया गया है।'))));
    } else if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(tr('Order $orderId saved.','ऑर्डर $orderId सहेजा गया।'))));
    }
    for (final id in cart.keys.toList()) {
      _cartWrite = _cartWrite.then((_) => LocalStore.instance.setQuantity(id, 0));
    }
    if (mounted) setState(cart.clear);
  }

  void showCart() {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (sheetContext) => StatefulBuilder(builder: (context, updateSheet) {
        void update(Product p, int delta) { changeQuantity(p, delta); updateSheet(() {}); }
        final chosen = products.where((p) => cart.containsKey(p.id)).toList();
        return SafeArea(child: Padding(
          padding: EdgeInsets.fromLTRB(20, 0, 20, MediaQuery.viewInsetsOf(context).bottom + 20),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Row(children: [
              Expanded(child: Text(tr('Your basket','आपकी टोकरी'),
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold))),
              IconButton(
                icon: const Icon(Icons.close),
                tooltip: tr('Close basket','टोकरी बंद करें'),
                onPressed: () => Navigator.pop(sheetContext),
              ),
            ]),
            const SizedBox(height: 12),
            if (chosen.isEmpty) Padding(padding: const EdgeInsets.symmetric(vertical: 32), child: Center(child: Text(tr('Your basket is empty. Add some fresh vegetables!','आपकी टोकरी खाली है। कुछ ताज़ी सब्ज़ियाँ जोड़ें!')))),
            if (chosen.isNotEmpty) ...[
              ConstrainedBox(constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(context).height * .42), child: ListView.builder(shrinkWrap: true, itemCount: chosen.length, itemBuilder: (_, i) {
                final p = chosen[i];
                return ListTile(contentPadding: EdgeInsets.zero, leading: Text(p.emoji, style: const TextStyle(fontSize: 30)), title: Text(productName(p.name,p.hindi)), subtitle: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(tr('${money(p.unitPrice(cart[p.id]??0))} / ${p.unit} · ${p.mandiActive(cart[p.id]??0)?'MANDI':'Mandi from ${p.mandiQuantity}'}','${money(p.unitPrice(cart[p.id]??0))} / ${p.unit} · ${p.mandiActive(cart[p.id]??0)?'मंडी भाव':'${p.mandiQuantity} से मंडी भाव'}')), TextButton.icon(onPressed: () => update(p, -(cart[p.id] ?? 0)), icon: const Icon(Icons.delete_outline, size: 18), label: Text(tr('Remove','हटाएँ')), style: TextButton.styleFrom(padding: EdgeInsets.zero, minimumSize: const Size(0, 40), alignment: Alignment.centerLeft))]), trailing: Row(mainAxisSize: MainAxisSize.min, children: [IconButton(tooltip: 'Remove one ${p.name}', onPressed: () => update(p, -1), icon: const Icon(Icons.remove_circle_outline)), Text('${cart[p.id]}'), IconButton(tooltip: 'Add one ${p.name}', onPressed: () => update(p, 1), icon: const Icon(Icons.add_circle_outline))]), onTap: () => showProductDetail(p, refreshCart: () => updateSheet(() {})));
              })),
              const Divider(),
              _totalRow(tr('Subtotal','उप-योग'), money(subtotal)),
              if(mandiSavings>0)_totalRow(tr('Mandi savings','मंडी बचत'),money(mandiSavings)), 
              _totalRow(tr('Delivery','डिलीवरी'), fee == 0 ? tr('Free','मुफ़्त') : money(fee)),
              const SizedBox(height: 6),
              _totalRow(tr('Estimated total','अनुमानित कुल'), money(subtotal + fee), bold: true),
              const SizedBox(height: 8),
              Text(tr('Free delivery from ${money(store['freeDeliveryAbove'] as num? ?? 499)} • Minimum order ${money(store['minimumOrder'] as num? ?? 99)}','${money(store['freeDeliveryAbove'] as num? ?? 499)} से मुफ़्त डिलीवरी • न्यूनतम ऑर्डर ${money(store['minimumOrder'] as num? ?? 99)}'), style: Theme.of(context).textTheme.bodySmall),
              const SizedBox(height: 16),
              FilledButton.icon(onPressed: () { Navigator.pop(sheetContext); checkout(); }, icon: const Icon(Icons.chat_bubble_outline), label: Text(tr('Place order','ऑर्डर करें'))),
            ],
          ]),
        ));
      }),
    );
  }

  void showProductDetail(Product product, {VoidCallback? refreshCart}) {
    Navigator.of(context).push(MaterialPageRoute<void>(
      builder: (detailContext) => StatefulBuilder(builder: (detailContext, refreshDetail) {
        final quantity = cart[product.id] ?? 0;
        void adjust(int delta) {
          changeQuantity(product, delta);
          refreshDetail(() {});
          refreshCart?.call();
        }
        return Scaffold(
          appBar: AppBar(
             title: Text(productName(product.name, product.hindi)),
             actions: [IconButton(
               icon: const Icon(Icons.close),
               tooltip: tr('Close product details','उत्पाद विवरण बंद करें'),
               onPressed: () => Navigator.of(detailContext).pop(),
             )],
           ),
          body: SafeArea(child: LayoutBuilder(builder: (context, bounds) => SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: Center(child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 650),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Container(
                  height: (bounds.maxHeight * .48).clamp(200.0, 460.0).toDouble(),
                  decoration: BoxDecoration(color: const Color(0xFFEAF4E9), borderRadius: BorderRadius.circular(24)),
                  child: product.imageUrl.isEmpty
                     ? Center(child:Text(product.emoji,style:const TextStyle(fontSize:120)))
                     : Image.network(product.imageUrl,fit:BoxFit.cover,
                         errorBuilder:(_,__,___)=>Center(child:Text(product.emoji,
                           style:const TextStyle(fontSize:120)))),
                ),
                const SizedBox(height: 24),
                Text(productName(product.name, product.hindi), style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.bold)),
                if (product.hindi.isNotEmpty) Text(EasyMandiLanguage.hindi.value ? product.name : product.hindi, style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 10),
                Text('${money(product.unitPrice(quantity))} / ${product.unit}', style: Theme.of(context).textTheme.titleLarge?.copyWith(color: forest, fontWeight: FontWeight.bold)),
                if(product.mandiEnabled)Text(product.mandiActive(quantity)
                  ?tr('🏷 MANDI RATE ACTIVE · Save ${money(product.mandiSavings(quantity))}','🏷 मंडी भाव लागू · बचत ${money(product.mandiSavings(quantity))}')
                  :tr('🏷 Add ${product.mandiQuantity-quantity} more for Mandi rate ${money(product.mandiPrice)}','🏷 मंडी भाव ${money(product.mandiPrice)} के लिए ${product.mandiQuantity-quantity} और जोड़ें'),
                   style:const TextStyle(color:Color(0xFF16814D),fontWeight:FontWeight.bold)),
                if (product.description.isNotEmpty) ...[const SizedBox(height: 18), Text(productDescription(product.description))],
                const SizedBox(height: 24),
                Row(children: [
                  Text(tr('Quantity','मात्रा'), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                  const Spacer(),
                  IconButton.filledTonal(tooltip: 'Remove one ${product.name}', onPressed: quantity == 0 ? null : () => adjust(-1), icon: const Icon(Icons.remove)),
                  Padding(padding: const EdgeInsets.symmetric(horizontal: 18), child: Text('$quantity', style: const TextStyle(fontSize: 20))),
                  IconButton.filledTonal(tooltip: 'Add one ${product.name}', onPressed: !product.available || quantity >= 99 ? null : () => adjust(1), icon: const Icon(Icons.add)),
                ]),
                const SizedBox(height: 12),
                Text(tr('Item total: ${money(product.lineTotal(quantity))}','सामान का कुल: ${money(product.lineTotal(quantity))}'), style: Theme.of(context).textTheme.titleMedium),
              ]),
            )),
          ))),
        );
      }),
    ));
  }

  Widget _totalRow(String label, String value, {bool bold = false}) => Padding(padding: const EdgeInsets.symmetric(vertical: 3), child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Text(label, style: TextStyle(fontWeight: bold ? FontWeight.bold : null)), Text(value, style: TextStyle(fontWeight: bold ? FontWeight.bold : null))]));

  Future<void> openOfficialStore() async {
    const link='https://easymandi.in/';
    try {
      if (!await launchUrl(Uri.parse(link), mode: LaunchMode.externalApplication) && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(tr(
          'Could not open easymandi.in. Please try your browser.',
          'easymandi.in नहीं खुल सका। कृपया ब्राउज़र में खोलें।'))));
      }
    } catch (_) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(tr(
        'The Easy Mandi website is unavailable right now.',
        'Easy Mandi वेबसाइट अभी उपलब्ध नहीं है।'))));
    }
  }

  Future<void> openDeveloperSite() async {
    final uri = Uri.parse('https://learnwithchampak.live');
    if (!await launchUrl(uri, mode: LaunchMode.externalApplication) && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(tr('Could not open learnwithchampak.live.','learnwithchampak.live नहीं खुल सका।'))));
    }
  }

  Future<void> openPrivacyPolicy() async {
    await openCustomerLegalPage('https://easymandi.in/privacy.html');
  }

  Future<void> openAccountDeletionPage() async {
    await openCustomerLegalPage('https://easymandi.in/delete-account.html');
  }

  Future<void> openCustomerLegalPage(String url) async {
    try {
      final opened = await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
      if (!opened && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(tr(
          'Could not open the page. Visit easymandi.in in your browser.',
          'पेज नहीं खुल सका। ब्राउज़र में easymandi.in खोलें।'))));
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(tr(
          'Could not open the page. Please try again.',
          'पेज नहीं खुल सका। दोबारा प्रयास करें।'))));
      }
    }
  }

  void showCredits() => showDialog<void>(
    context: context,
    builder: (dialogContext) => AlertDialog(
      title: customerDialogTitle(dialogContext,'Easy Mandi'),
      content: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(tr('Developed and maintained by Champak Roy','विकसित और अनुरक्षित: Champak Roy')),
        TextButton.icon(onPressed: openOfficialStore, icon: const Icon(Icons.storefront_outlined), label: const Text('easymandi.in')),
        TextButton.icon(onPressed: openDeveloperSite, icon: const Icon(Icons.open_in_new), label: const Text('learnwithchampak.live')),
        TextButton.icon(onPressed: openPrivacyPolicy, icon: const Icon(Icons.privacy_tip_outlined),
          label: Text(tr('Privacy policy','गोपनीयता नीति'))),
        TextButton.icon(onPressed: openAccountDeletionPage, icon: const Icon(Icons.person_remove_outlined),
          label: Text(tr('Request account deletion','खाता हटाने का अनुरोध'))),
      ]),
      actions: [TextButton(onPressed: () => Navigator.of(dialogContext).pop(), child: Text(tr('Close','बंद करें')))],
    ),
  );

  @override
  Widget build(BuildContext context) {
    final filtered=products.where((p)=>
      (category=='All'||p.category==category)
      &&(!favoritesOnly||favoriteIds.contains(p.id))
      &&'${p.name} ${p.hindi} ${p.category}'.toLowerCase()
          .contains(query.toLowerCase())).toList();
    if(category=='All'&&query.trim().isEmpty&&popularProductIds.isNotEmpty){
      final rank={for(var i=0;i<popularProductIds.length;i++)popularProductIds[i]:i};
      filtered.sort((a,b)=>(rank[a.id]??999).compareTo(rank[b.id]??999));
    }
    final freeAbove=store['freeDeliveryAbove'] as num? ?? 499;
    final remaining=(freeAbove-subtotal).clamp(0,double.infinity);
    return Scaffold(
      appBar:AppBar(
        title:Row(mainAxisSize:MainAxisSize.min,children:[
          Image.asset('assets/brand-symbol.png',width:35,height:35,
            errorBuilder:(_,__,___)=>const Icon(Icons.shopping_cart_outlined)),
          const SizedBox(width:8),
          const Flexible(child:Text('Easy Mandi',maxLines:1,overflow:TextOverflow.ellipsis,
            style:TextStyle(fontSize:17,fontWeight:FontWeight.w900))),
        ]),
        actions:[
          const LanguageButton(),
          IconButton(
            tooltip:favoritesOnly?tr('Show all products','सभी उत्पाद दिखाएँ'):tr('Show favorites','पसंदीदा दिखाएँ'),
            icon:Icon(favoritesOnly?Icons.favorite:Icons.favorite_border,
              color:favoritesOnly?const Color(0xFFD82971):null),
            onPressed:()=>setState(()=>favoritesOnly=!favoritesOnly)),
          IconButton(
            tooltip:signedInUser==null?tr('Register or sign in','रजिस्टर या साइन इन करें'):tr('My account','मेरा खाता'),
            onPressed:openAccount,
            icon:Icon(signedInUser==null?Icons.person_outline:Icons.account_circle)),
          PopupMenuButton<String>(
            tooltip:tr('More options','और विकल्प'),
            onSelected:(choice)async{
              if(choice=='refresh'){await loadCatalog();return;}
              if(choice=='about'){showCredits();return;}
              if(choice=='orders'){await openOrders();return;}
            },
            itemBuilder:(ctx)=>[
              PopupMenuItem(value:'orders',child:Text(tr('My orders, deliveries & QR','मेरे ऑर्डर, डिलीवरी और QR'))),
              PopupMenuItem(value:'refresh',child:Text(tr('Refresh catalog','कैटलॉग रीफ़्रेश करें'))),
              PopupMenuItem(value:'about',child:Text(tr('About Easy Mandi','Easy Mandi के बारे में'))),
            ],
          ),
        ],
      ),
      body:loading?const Center(child:CircularProgressIndicator())
        :message.isNotEmpty?Center(child:Column(mainAxisSize:MainAxisSize.min,children:[
            Text(message,textAlign:TextAlign.center),
            TextButton(onPressed:loadCatalog,child:Text(tr('Retry','फिर प्रयास करें'))),
          ]))
        :Column(children:[
          Padding(padding:const EdgeInsets.fromLTRB(14,10,14,7),child:Column(children:[
            Row(children:[
              Expanded(child:Text(
                tr('Fruits & Vegetables','फल और सब्ज़ियाँ'),
                style:const TextStyle(fontSize:19,fontWeight:FontWeight.w900,color:Color(0xFF273648)))),
              Text(tr('${filtered.length} products','${filtered.length} उत्पाद'),
                style:const TextStyle(fontSize:12,color:Color(0xFF667789))),
            ]),
            const SizedBox(height:9),
            SizedBox(height:45,child:TextField(
              controller:_searchController,
              onChanged:(value)=>setState(()=>query=value),
              decoration:InputDecoration(
                contentPadding:const EdgeInsets.symmetric(horizontal:10),
                hintText:tr('Search fruits, vegetables, essentials…','फल, सब्ज़ी, किराने का सामान खोजें…'),
                hintStyle:const TextStyle(fontSize:12),
                prefixIcon:const Icon(Icons.search,size:21),
                suffixIcon:query.isEmpty?null:IconButton(
                  tooltip:tr('Clear search','खोज साफ करें'),
                  onPressed:(){_searchController.clear();setState(()=>query='');},
                  icon:const Icon(Icons.close,size:17)),
              ),
            )),
            if(favoritesOnly)Padding(padding:const EdgeInsets.only(top:5),
              child:Text(tr('Showing favorites only','केवल पसंदीदा उत्पाद'),
                style:const TextStyle(color:Color(0xFFD82971),fontSize:11))),
            if(recentItems.isNotEmpty||signedInUser!=null)ExpansionTile(
              key:const PageStorageKey('recently-ordered'),
              initiallyExpanded:true,
              tilePadding:EdgeInsets.zero,childrenPadding:EdgeInsets.zero,
              dense:true,
              title:Row(children:[
                const Icon(Icons.history,color:forest,size:20),
                const SizedBox(width:6),
                Expanded(child:Text(tr('Previously ordered items','पहले मँगाए गए सामान'),
                  style:const TextStyle(fontWeight:FontWeight.w800,fontSize:13))),
                if(signedInUser!=null)
                  IconButton(
                    tooltip:tr('Refresh previous orders','पिछले ऑर्डर अपडेट करें'),
                    icon:recentItemsLoading
                      ?const SizedBox(height:16,width:16,child:CircularProgressIndicator(strokeWidth:2))
                      :const Icon(Icons.refresh,size:20),
                    onPressed:recentItemsLoading?null:syncCustomerData),
              ]),
              children:recentItems.isEmpty?[
                Padding(padding:const EdgeInsets.fromLTRB(8,0,8,12),
                  child:Text(recentItemsError??(recentItemsLoading
                    ?tr('Loading your previous purchases…','आपकी पिछली खरीदारी खुल रही है…')
                    :tr('No previously ordered products yet. Products from your orders appear here automatically.',
                      'अभी पहले मँगाए गए सामान नहीं हैं। ऑर्डर करते ही वे यहाँ दिखेंगे।')),
                    style:const TextStyle(fontSize:12,color:Color(0xFF546A76)))),
              ]:[
                SizedBox(height:105,child:ListView.separated(
                  scrollDirection:Axis.horizontal,
                  itemCount:recentItems.length,
                  separatorBuilder:(_,__)=>const SizedBox(width:6),
                  itemBuilder:(ctx,i){
                    final item=recentItems[i];
                    Product? found;
                    for(final p in products){if(p.id==item.productId){found=p;break;}}
                    final target=found;
                    return SizedBox(width:175,child:Card(
                      color:Colors.white,elevation:0,
                      child:InkWell(onTap:target==null?null:()=>showProductDetail(target),
                        child:Padding(padding:const EdgeInsets.all(9),
                          child:Row(children:[
                            Text(target?.emoji??item.emoji,style:const TextStyle(fontSize:27)),
                            const SizedBox(width:6),
                            Expanded(child:Column(mainAxisAlignment:MainAxisAlignment.center,
                              crossAxisAlignment:CrossAxisAlignment.start,children:[
                                Text(target==null?item.name:productName(target.name,target.hindi),
                                  maxLines:2,overflow:TextOverflow.ellipsis,
                                  style:const TextStyle(fontSize:12,fontWeight:FontWeight.w700)),
                                Text(item.unit,maxLines:1,overflow:TextOverflow.ellipsis,
                                  style:const TextStyle(fontSize:10,color:Colors.grey)),
                                if(target!=null&&target.available)
                                  InkWell(onTap:()=>changeQuantity(target,1),
                                    child:Padding(padding:const EdgeInsets.symmetric(vertical:4),
                                      child:Text(tr('Add again +','फिर जोड़ें +'),
                                        style:const TextStyle(color:forest,fontSize:12,fontWeight:FontWeight.w800)))),
                                if(target==null||!target.available)
                                  Text(tr('Currently unavailable','अभी उपलब्ध नहीं'),
                                    style:const TextStyle(fontSize:10,color:Colors.grey)),
                              ])),
                          ])),
                      ),
                    ));
                  },
                )),
              ],
            ),
          ])),
          Expanded(child:StoreGallery(
            key:ValueKey(marketResetSerial),
            products:filtered,categories:categories,
            selectedCategory:category,quantities:cart,
            favorites:favoriteIds,
            onCategorySelected:(selected)=>setState(()=>category=selected),
            onProductTap:showProductDetail,
            onQuantityChanged:changeQuantity,
            onFavoriteTap:toggleFavorite,
          )),
        ]),
      bottomNavigationBar:SafeArea(top:false,
        child:Column(mainAxisSize:MainAxisSize.min,children:[
          CustomerNavigation(
            active: CustomerNavPage.market,
            onMarket: showMarket,
            onOrders: () { openOrders(); },
          ),
          Container(
          padding:const EdgeInsets.fromLTRB(13,7,13,9),
          decoration:const BoxDecoration(color:Color(0xFF273743),
            borderRadius:BorderRadius.vertical(top:Radius.circular(19))),
          child:Column(mainAxisSize:MainAxisSize.min,children:[
            Row(children:[
              const Icon(Icons.local_shipping_outlined,color:Color(0xFFB9DFE2),size:18),
              const SizedBox(width:8),
              Expanded(child:Text(
                subtotal>=freeAbove
                  ?tr('Free delivery unlocked','मुफ़्त डिलीवरी मिल गई')
                  :count==0
                    ?tr('Free delivery above ₹$freeAbove','₹$freeAbove से ऊपर मुफ़्त डिलीवरी')
                    :tr('Add ₹$remaining more for free delivery','मुफ़्त डिलीवरी के लिए ₹$remaining और जोड़ें'),
                maxLines:1,overflow:TextOverflow.ellipsis,
                style:const TextStyle(color:Colors.white,fontSize:12,fontWeight:FontWeight.w600))),
            ]),
            if(count>0)...[
              const SizedBox(height:6),
              SizedBox(width:double.infinity,height:42,child:FilledButton.icon(
                onPressed:showCart,
                icon:const Icon(Icons.shopping_basket_outlined,size:19),
                label:Text(tr('View basket · $count items · ${money(subtotal+fee)}',
                  'टोकरी · $count सामान · ${money(subtotal+fee)}'),
                  maxLines:1,overflow:TextOverflow.ellipsis),
              )),
            ],
          ]),
        ),
        ])),
    );
  }
}
