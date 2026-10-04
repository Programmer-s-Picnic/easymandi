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
import 'account_page.dart';
import 'auth_service.dart';
import 'delivery_page.dart';
import 'local_store.dart';
import 'product.dart';
import 'checkout_utils.dart';
import 'notification_overlay.dart';
import 'i18n.dart';

const catalogUrl =
    'https://cserver.learnwithchampak.live/easymandi/api/catalog.php';
const forest = Color(0xFF176B46);
const pale = Color(0xFFF4F8F3);

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
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
  List<RecentItem> recentItems = [];
  AuthUser? signedInUser;
  Map<String, dynamic> store = {};
  Map<String, dynamic> checkoutRules = {};
  List<String> categories = ['All'];
  final Map<String, int> cart = {};
  Future<void> _cartWrite = Future.value();
  String? _pendingOrderKey;
  String category = 'All', query = '', message = '';
  Timer? notificationTimer;
  bool checkingNotifications=false;
  int? notificationUserId;
  final Set<String> shownNotifications={};
  bool loading = true;

  @override
  void initState() {
    super.initState();
    notificationMark=(n) async {
      if(n==null || n['_audience']=='order')await AuthService.instance.orderNotifications(markAll:n==null,id:n==null?null:notificationId(n));
      if(n==null || n['_audience']=='delivery')await AuthService.instance.deliveryRequest(markAll:n==null,orderId:n==null?null:notificationId(n));
      await checkNotifications();
    };
    loadCatalog();
    restoreAccount();
    notificationTimer=Timer.periodic(const Duration(minutes:5),(_)=>checkNotifications());
  }

  @override
  void dispose(){notificationTimer?.cancel();super.dispose();}
  Future<void> saveCustomerAddress(SavedAddress address) async {
    if(signedInUser==null){await LocalStore.instance.saveAddress(address);return;}
    await AuthService.instance.saveServerAddress({...address.toRow(),if(address.id!=null)'id':address.id});
  }
  bool syncingCustomerData=false;
  Future<void> syncCustomerData() async {
    final user=AuthService.instance.user;if(user==null||syncingCustomerData)return;
    syncingCustomerData=true;
    try {
      final prefs=await SharedPreferences.getInstance();
      final migrationKey='server-address-migration-${user.id}';
      if(prefs.getBool(migrationKey)!=true){for(final address in await LocalStore.instance.loadAddresses()){if(AuthService.instance.user?.id!=user.id)return;await AuthService.instance.saveServerAddress(address.toRow());}await prefs.setBool(migrationKey,true);}
      final response=await AuthService.instance.customerData();
      if(!mounted || AuthService.instance.user?.id!=user.id)return;
      final rows=response['items'] as List<dynamic>? ?? [];
      setState(()=>recentItems=rows.map((raw){final r=raw as Map<String,dynamic>;return RecentItem(productId:r['product_id'] as String,name:r['name'] as String,unit:r['unit'] as String,emoji:'🥬',quantity:int.tryParse('${r['quantity']}')??1,requestedAt:0);}).toList());
    } catch (_) { /* Device history remains available offline. */ } finally {syncingCustomerData=false;}
  }
  Future<void> checkNotifications() async {
    final account=AuthService.instance.user;
    if(account==null){notificationFeed.value=[];shownNotifications.clear();notificationUserId=null;return;}
    if(checkingNotifications || WidgetsBinding.instance.lifecycleState!=AppLifecycleState.resumed)return;
    checkingNotifications=true;
    await syncCustomerData();
    if(notificationUserId!=account.id){shownNotifications.clear();notificationUserId=account.id;}
    try {
      final feeds=await Future.wait([
        AuthService.instance.orderNotifications().catchError((Object _) => <String,dynamic>{}),
        AuthService.instance.deliveryRequest().catchError((Object _) => <String,dynamic>{}),
      ]);
      if(feeds.every((feed)=>feed.isEmpty))return;
      final orders=feeds[0], deliveries=feeds[1];
      if(!mounted || AuthService.instance.user?.id!=account.id)return;
      final fresh=<String>[];
      final feed=<Map<String,dynamic>>[];
      for(final entry in {'order':orders,'delivery':deliveries}.entries){
        for(final raw in entry.value['notifications'] as List<dynamic>? ?? []){
          feed.add({...Map<String,dynamic>.from(raw as Map),'_audience':entry.key});
          final key='${entry.key}:${raw['id']}';
          if(raw['read_at']==null && !shownNotifications.contains(key))fresh.add(raw['message'] as String? ?? 'Order update');
          shownNotifications.add(key);
        }
      }
      feed.sort((a,b)=>(b['created_at']?.toString() ?? '').compareTo(a['created_at']?.toString() ?? ''));
      notificationFeed.value=feed;
      if(fresh.isNotEmpty)ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        duration:const Duration(seconds:20),content:Text('${fresh.length} new notification(s): ${fresh.first}')));
    }catch(_){/* Retry automatically at the next check without a password prompt. */}
    finally{checkingNotifications=false;}
  }

  Future<void> restoreAccount() async {
    try {
      final account = await AuthService.instance.restore();
      if (mounted) {setState(() => signedInUser = account);checkNotifications();syncCustomerData();}
    } catch (_) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(tr('Could not restore your account. Sign in again.','आपका खाता पुनः लोड नहीं हो सका। फिर से साइन इन करें।'))));
    }
  }

  Future<void> openAccount() async {
    if (signedInUser == null) {
      final account = await Navigator.push<AuthUser>(context,
        MaterialPageRoute(builder: (_) => const AccountPage()));
      if (mounted && account != null) {setState(() => signedInUser = account);checkNotifications();syncCustomerData();}
      return;
    }
    final account = signedInUser!;
    await showDialog<void>(context: context, builder: (dialogContext) => AlertDialog(
      title: Text(tr('My account','मेरा खाता')),
      content: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start,
        children: [Text(account.name), Text('+91 ${account.mobile}'),
          if (account.email != null && account.email!.isNotEmpty) Text(account.email!),
          const SizedBox(height: 12),
          Text(tr('Signing out clears this device. Addresses saved to your account remain available when you sign in again.','साइन आउट करने पर इस डिवाइस का स्थानीय डेटा साफ होगा। खाते में सहेजे पते अगली बार साइन इन करने पर उपलब्ध रहेंगे।'))]),
      actions: [
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
        recentItems = recent;
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
  num get subtotal => products.fold<num>(0, (sum, p) => sum + p.price * (cart[p.id] ?? 0));
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
        title: Text(tr('UPI payment · $orderId','UPI भुगतान · $orderId')),
        content: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: [
          Text(tr('Pay exactly ${money(total)}','ठीक ${money(total)} भुगतान करें'), style: Theme.of(dialogContext).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold)),
          const SizedBox(height: 10),
          Text('${payment['payeeName']}'),
          SelectableText('${payment['upiId']}', style: const TextStyle(fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),
          QrImageView(data: payment['upiUri'] as String, size: 220),
          const SizedBox(height: 10),
          FilledButton.icon(
            onPressed: () async {
              final uri=Uri.parse(payment['upiUri'] as String);
              final opened=await launchUrl(uri, mode: LaunchMode.externalApplication);
              if(!opened && dialogContext.mounted) {
                ScaffoldMessenger.of(dialogContext).showSnackBar(SnackBar(content: Text(tr('No UPI app could be opened. Scan the QR instead.','कोई UPI ऐप नहीं खुला। इसके बजाय QR स्कैन करें।'))));
              }
            },
            icon: const Icon(Icons.account_balance_wallet_outlined),
            label: Text(tr('Open UPI app','UPI ऐप खोलें')),
          ),
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
    final minimum = (store['minimumOrder'] as num? ?? 99);
    if (subtotal < minimum) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(tr('Minimum order is ${money(minimum)}. Add ${money(minimum - subtotal)} more.','न्यूनतम ऑर्डर ${money(minimum)} है। ${money(minimum - subtotal)} और जोड़ें।'))));
      return;
    }
    final name = TextEditingController(text: signedInUser?.name ?? '');
    final phone = TextEditingController(text: signedInUser?.mobile ?? '');
    final house = TextEditingController();
    final locality = TextEditingController();
    final landmark = TextEditingController();
    final pin = TextEditingController();
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
        title: Text(tr('Place order','ऑर्डर करें')),
        content: Form(
          key: form,
          child: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: [
            Text(tr('Your order will be saved for the Easy Mandi team. You can also send its reference by WhatsApp. Confirm final price and delivery before payment.','आपका ऑर्डर Easy Mandi टीम के लिए सहेजा जाएगा। आप इसका रेफरेंस WhatsApp पर भी भेज सकते हैं। भुगतान से पहले अंतिम कीमत और डिलीवरी की पुष्टि करें।')),
            const SizedBox(height: 16),
            if (savedAddresses.isNotEmpty) DropdownButtonFormField<int?>(
              key: ValueKey(selectedAddress?.id),
              initialValue: selectedAddress?.id,
              decoration: InputDecoration(labelText: tr('Delivery address','डिलीवरी पता')),
              items: [DropdownMenuItem<int?>(value: null, child: Text(tr('Use a new address','नया पता इस्तेमाल करें'))),
                ...savedAddresses.map((a) => DropdownMenuItem<int?>(value: a.id, child: Text('${a.house}, ${a.locality} • ${a.pin}', overflow: TextOverflow.ellipsis)))],
              onChanged: (id) => updateDialog(() {
                selectedAddress = id == null ? null : savedAddresses.firstWhere((a) => a.id == id);
                final a = selectedAddress;
                name.text = a?.name ?? ''; phone.text = a?.phone ?? '';
                house.text = a?.house ?? ''; locality.text = a?.locality ?? '';
                landmark.text = a?.landmark ?? ''; pin.text = a?.pin ?? '';
              }),
            ),
            if (savedAddresses.isNotEmpty) const SizedBox(height: 10),
            TextFormField(controller: name, decoration: InputDecoration(labelText: tr('Your name','आपका नाम')), textCapitalization: TextCapitalization.words, validator: (v) => v == null || v.trim().length < 2 ? tr('Enter your name','अपना नाम दर्ज करें') : null),
            const SizedBox(height: 10),
            TextFormField(
              controller: phone,
              decoration: InputDecoration(labelText: tr('Mobile number','मोबाइल नंबर'), prefixText: '$countryCode ', hintText: checkoutRules['mobileExample'] as String? ?? '9876543210', helperText: tr('10 digits, starting with 6, 7, 8 or 9','10 अंक, 6, 7, 8 या 9 से शुरू')),
              keyboardType: TextInputType.phone,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(10)],
              validator: (v) => mobilePattern.hasMatch(v?.trim() ?? '') ? null : tr('Enter a valid 10-digit Indian mobile number','मान्य 10 अंकों का भारतीय मोबाइल नंबर दर्ज करें'),
            ),
            const SizedBox(height: 10),
            TextFormField(controller: house, decoration: InputDecoration(labelText: tr('House / flat / building','मकान / फ्लैट / बिल्डिंग'), hintText: tr('House 12','मकान 12')), textCapitalization: TextCapitalization.words, validator: (v) => (v?.trim().length ?? 0) >= 2 && RegExp(r'[A-Za-z0-9\u0900-\u097F]').hasMatch(v!.trim()) ? null : tr('Enter a house or building number/name','मकान या बिल्डिंग का नंबर/नाम दर्ज करें')),
            const SizedBox(height: 10),
            TextFormField(controller: locality, decoration: InputDecoration(labelText: tr('Street / locality','गली / मोहल्ला'), hintText: 'Lanka'), textCapitalization: TextCapitalization.words, validator: (v) => (v?.trim().length ?? 0) >= 5 && RegExp(r'[A-Za-z0-9\u0900-\u097F]').hasMatch(v!.trim()) ? null : tr('Enter a street/locality (at least 5 characters)','गली/मोहल्ला दर्ज करें (कम से कम 5 अक्षर)')),
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
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.message)));
      return;
    }
    if (!mounted) return;
    final orderId = savedOrder['orderId'] as String;
    final savedTotal = savedOrder['total'] as num;
    final lines = products.where((p) => cart.containsKey(p.id))
        .map((p) => '• ${p.name} (${p.unit}) × ${cart[p.id]}').join('\n');
    final address = [house.text.trim(), locality.text.trim(),
      if (landmark.text.trim().isNotEmpty) 'Near ${landmark.text.trim()}',
      '$city, $state - ${pin.text.trim()}'].join(', ');
    final body = 'Hello Easy Mandi, my order $orderId has been placed.\n\n$lines'
        '\n\nTotal: ${money(savedTotal)}\nName: ${name.text.trim()}'
        '\nMobile: $countryCode ${phone.text.trim()}\nAddress: $address'
        '\nPayment: ${paymentMethod == 'upi' ? 'UPI selected' : 'Cash on Delivery'}'
        '\n\nPlease confirm availability and delivery time.';
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
            Text('Your basket', style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            if (chosen.isEmpty) const Padding(padding: EdgeInsets.symmetric(vertical: 32), child: Center(child: Text('Your basket is empty. Add some fresh vegetables!'))),
            if (chosen.isNotEmpty) ...[
              ConstrainedBox(constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(context).height * .42), child: ListView.builder(shrinkWrap: true, itemCount: chosen.length, itemBuilder: (_, i) {
                final p = chosen[i];
                return ListTile(contentPadding: EdgeInsets.zero, leading: Text(p.emoji, style: const TextStyle(fontSize: 30)), title: Text(p.name), subtitle: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('${money(p.price)} / ${p.unit} · Tap for details'), TextButton.icon(onPressed: () => update(p, -(cart[p.id] ?? 0)), icon: const Icon(Icons.delete_outline, size: 18), label: const Text('Remove'), style: TextButton.styleFrom(padding: EdgeInsets.zero, minimumSize: const Size(0, 40), alignment: Alignment.centerLeft))]), trailing: Row(mainAxisSize: MainAxisSize.min, children: [IconButton(tooltip: 'Remove one ${p.name}', onPressed: () => update(p, -1), icon: const Icon(Icons.remove_circle_outline)), Text('${cart[p.id]}'), IconButton(tooltip: 'Add one ${p.name}', onPressed: () => update(p, 1), icon: const Icon(Icons.add_circle_outline))]), onTap: () => showProductDetail(p, refreshCart: () => updateSheet(() {})));
              })),
              const Divider(),
              _totalRow('Subtotal', money(subtotal)),
              _totalRow('Delivery', fee == 0 ? 'Free' : money(fee)),
              const SizedBox(height: 6),
              _totalRow('Estimated total', money(subtotal + fee), bold: true),
              const SizedBox(height: 8),
              Text('Free delivery from ${money(store['freeDeliveryAbove'] as num? ?? 499)} • Minimum order ${money(store['minimumOrder'] as num? ?? 99)}', style: Theme.of(context).textTheme.bodySmall),
              const SizedBox(height: 16),
              FilledButton.icon(onPressed: () { Navigator.pop(sheetContext); checkout(); }, icon: const Icon(Icons.chat_bubble_outline), label: const Text('Place order')),
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
          appBar: AppBar(title: Text(product.name)),
          body: SafeArea(child: LayoutBuilder(builder: (context, bounds) => SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: Center(child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 650),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Container(
                  height: (bounds.maxHeight * .48).clamp(200.0, 460.0).toDouble(),
                  decoration: BoxDecoration(color: const Color(0xFFEAF4E9), borderRadius: BorderRadius.circular(24)),
                  child: Center(child: Text(product.emoji, style: const TextStyle(fontSize: 120))),
                ),
                const SizedBox(height: 24),
                Text(product.name, style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.bold)),
                if (product.hindi.isNotEmpty) Text(product.hindi, style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 10),
                Text('${money(product.price)} / ${product.unit}', style: Theme.of(context).textTheme.titleLarge?.copyWith(color: forest, fontWeight: FontWeight.bold)),
                if (product.description.isNotEmpty) ...[const SizedBox(height: 18), Text(product.description)],
                const SizedBox(height: 24),
                Row(children: [
                  const Text('Quantity', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                  const Spacer(),
                  IconButton.filledTonal(tooltip: 'Remove one ${product.name}', onPressed: quantity == 0 ? null : () => adjust(-1), icon: const Icon(Icons.remove)),
                  Padding(padding: const EdgeInsets.symmetric(horizontal: 18), child: Text('$quantity', style: const TextStyle(fontSize: 20))),
                  IconButton.filledTonal(tooltip: 'Add one ${product.name}', onPressed: !product.available || quantity >= 99 ? null : () => adjust(1), icon: const Icon(Icons.add)),
                ]),
                const SizedBox(height: 12),
                Text('Item total: ${money(product.price * quantity)}', style: Theme.of(context).textTheme.titleMedium),
              ]),
            )),
          ))),
        );
      }),
    ));
  }

  Widget _totalRow(String label, String value, {bool bold = false}) => Padding(padding: const EdgeInsets.symmetric(vertical: 3), child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Text(label, style: TextStyle(fontWeight: bold ? FontWeight.bold : null)), Text(value, style: TextStyle(fontWeight: bold ? FontWeight.bold : null))]));

  Future<void> openDeveloperSite() async {
    final uri = Uri.parse('https://learnwithchampak.live');
    if (!await launchUrl(uri, mode: LaunchMode.externalApplication) && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Could not open learnwithchampak.live.')));
    }
  }

  void showCredits() => showDialog<void>(
    context: context,
    builder: (dialogContext) => AlertDialog(
      title: const Text('Easy Mandi'),
      content: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Developed and maintained by Champak Roy'),
        TextButton.icon(onPressed: openDeveloperSite, icon: const Icon(Icons.open_in_new), label: const Text('learnwithchampak.live')),
      ]),
      actions: [TextButton(onPressed: () => Navigator.of(dialogContext).pop(), child: const Text('Close'))],
    ),
  );

  @override
  Widget build(BuildContext context) {
    final filtered = products.where((p) => (category == 'All' || p.category == category) && '${p.name} ${p.hindi} ${p.category}'.toLowerCase().contains(query.toLowerCase())).toList();
    return Scaffold(
      appBar: AppBar(title: const Row(children: [Text('🥬 ', style: TextStyle(fontSize: 28)), Text('Easy Mandi', style: TextStyle(fontWeight: FontWeight.w800))]), actions: [const LanguageButton(), IconButton(tooltip: signedInUser == null ? tr('Register or sign in','रजिस्टर या साइन इन करें') : tr('My account and sign out','मेरा खाता और साइन आउट'), onPressed: openAccount, icon: Icon(signedInUser == null ? Icons.person_outline : Icons.account_circle)), IconButton(tooltip: tr('My deliveries','मेरी डिलीवरी'), onPressed: () async { if (signedInUser == null) { await openAccount(); } if (mounted && signedInUser != null) Navigator.push(context, MaterialPageRoute<void>(builder: (_) => const DeliveryPage())); }, icon: const Icon(Icons.local_shipping_outlined)), IconButton(tooltip: tr('About and developer','जानकारी और डेवलपर'), onPressed: showCredits, icon: const Icon(Icons.info_outline)), IconButton(tooltip: tr('Refresh catalog','कैटलॉग रीफ़्रेश करें'), onPressed: loadCatalog, icon: const Icon(Icons.refresh))]),
      body: loading ? const Center(child: CircularProgressIndicator()) : message.isNotEmpty ? Center(child: Column(mainAxisSize: MainAxisSize.min, children: [Text(message), TextButton(onPressed: loadCatalog, child: Text(tr('Retry','फिर प्रयास करें')))])) : CustomScrollView(slivers: [
        SliverToBoxAdapter(child: Padding(padding: const EdgeInsets.fromLTRB(18, 8, 18, 0), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Container(width: double.infinity, padding: const EdgeInsets.all(22), decoration: BoxDecoration(color: forest, borderRadius: BorderRadius.circular(24)), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(tr('FRESH FROM THE MANDI','मंडी से ताज़ा'), style: const TextStyle(color: Color(0xFFBCEAD1), fontWeight: FontWeight.bold, letterSpacing: 1.2)),
            const SizedBox(height: 10),
            Text(tr('Good food starts fresh.','अच्छा खाना ताज़गी से शुरू होता है।'), style: const TextStyle(color: Colors.white, fontSize: 27, fontWeight: FontWeight.w800)),
            const SizedBox(height: 7),
            Text(tr('Vegetables for your everyday kitchen • ${store['city'] ?? 'Varanasi'}','आपकी रोज़ की रसोई के लिए ताज़ी सब्ज़ियाँ • ${store['city'] ?? 'Varanasi'}'), style: const TextStyle(color: Colors.white70)),
          ])),
          const SizedBox(height: 16),
          if (recentItems.isNotEmpty) ...[
            Text(tr('Previously ordered items','पहले मँगाए गए सामान'), style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            SizedBox(height: 88, child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: recentItems.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (context, index) {
                final item = recentItems[index];
                Product? current;
                for (final p in products) {
                  if (p.id == item.productId) { current = p; break; }
                }
                final available = current != null && current.available;
                final product = current;
                return SizedBox(width: 200, child: Card(
                  color: Colors.white, elevation: 0,
                  child: InkWell(onTap: product == null ? null : () => showProductDetail(product), child: Padding(padding: const EdgeInsets.all(8), child: Row(children: [
                    Text(item.emoji, style: const TextStyle(fontSize: 29)),
                    const SizedBox(width: 6),
                    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.center, children: [
                      Text(product == null ? item.name : productName(product.name, product.hindi), maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.bold)),
                      Text(available ? '${money(product!.price)} / ${product.unit}' : tr('Unavailable','उपलब्ध नहीं'), style: Theme.of(context).textTheme.bodySmall),
                    ])),
                    IconButton(tooltip: available ? 'Add ${item.name} again' : '${item.name} unavailable',
                      onPressed: available ? () => changeQuantity(product!, 1) : null,
                      icon: const Icon(Icons.add_circle_outline)),
                  ])))),
                );
              },
            )),
            const SizedBox(height: 16),
          ],
          TextField(onChanged: (v) => setState(() => query = v), decoration: InputDecoration(prefixIcon: const Icon(Icons.search), hintText: tr('Search onions, potatoes, tomatoes...','प्याज, आलू, टमाटर खोजें...'))),
          const SizedBox(height: 14),
          SizedBox(height: 44, child: ListView.separated(scrollDirection: Axis.horizontal, itemCount: categories.length, separatorBuilder: (_, __) => const SizedBox(width: 8), itemBuilder: (_, i) => ChoiceChip(label: Text(categoryText(categories[i])), selected: category == categories[i], onSelected: (_) => setState(() => category = categories[i])))),
          const SizedBox(height: 18),
          Text(tr('Shop fresh','ताज़ा खरीदें'), style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold)),
          const SizedBox(height: 5),
          Text(tr('${filtered.length} products','${filtered.length} उत्पाद'), style: Theme.of(context).textTheme.bodySmall),
          const SizedBox(height: 12),
        ]))),
        if (filtered.isEmpty) SliverFillRemaining(child: Center(child: Text(tr('No matching products. Try another search.','कोई मिलते-जुलते उत्पाद नहीं मिले। दूसरी खोज करें।')))),
        SliverPadding(padding: const EdgeInsets.fromLTRB(18, 0, 18, 16), sliver: SliverLayoutBuilder(builder: (context, constraints) {
          final columns = constraints.crossAxisExtent >= 700 ? 4 : constraints.crossAxisExtent >= 460 ? 3 : 2;
          return SliverGrid.builder(itemCount: filtered.length, gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: columns, mainAxisSpacing: 12, crossAxisSpacing: 12, mainAxisExtent: 252), itemBuilder: (_, i) {
            final p = filtered[i];
            return Card(elevation: 0, color: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)), clipBehavior: Clip.antiAlias, child: InkWell(onTap: () => showProductDetail(p), child: Padding(padding: const EdgeInsets.all(12), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Expanded(child: Container(width: double.infinity, decoration: BoxDecoration(color: const Color(0xFFEAF4E9), borderRadius: BorderRadius.circular(12)), child: Center(child: Text(p.emoji, style: const TextStyle(fontSize: 62))))),
              const SizedBox(height: 8),
              Text(productName(p.name, p.hindi), maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
              Text('${EasyMandiLanguage.hindi.value ? p.name : p.hindi} • ${p.unit}', maxLines: 1, overflow: TextOverflow.ellipsis, style: Theme.of(context).textTheme.bodySmall),
              const Spacer(),
              Row(children: [Expanded(child: Text(money(p.price), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: forest))), if (!p.available) Text(tr('Sold out','स्टॉक खत्म')) else if ((cart[p.id] ?? 0) == 0) IconButton.filled(tooltip: 'Add ${p.name}', onPressed: () => changeQuantity(p, 1), icon: const Icon(Icons.add)) else Row(mainAxisSize: MainAxisSize.min, children: [InkWell(onTap: () => changeQuantity(p, -1), child: const Icon(Icons.remove_circle_outline, size: 26)), Padding(padding: const EdgeInsets.symmetric(horizontal: 6), child: Text('${cart[p.id]}')), InkWell(onTap: () => changeQuantity(p, 1), child: const Icon(Icons.add_circle, color: forest, size: 26))])]),
            ]))));
          });
        })),
        SliverToBoxAdapter(child: Padding(
          padding: const EdgeInsets.fromLTRB(18, 6, 18, 110),
          child: Center(child: TextButton(onPressed: openDeveloperSite, child: Text(tr('Developed and maintained by Champak Roy\nlearnwithchampak.live','विकसित और अनुरक्षित: Champak Roy\nlearnwithchampak.live'), textAlign: TextAlign.center))),
        )),
      ]),
      bottomNavigationBar: count == 0 ? null : SafeArea(child: Padding(padding: const EdgeInsets.fromLTRB(18, 8, 18, 12), child: FilledButton.icon(onPressed: showCart, icon: const Icon(Icons.shopping_basket_outlined), label: Padding(padding: const EdgeInsets.symmetric(vertical: 14), child: Text(tr('View basket • $count items • ${money(subtotal + fee)}','टोकरी देखें • $count सामान • ${money(subtotal + fee)}')))))),
    );
  }
}

