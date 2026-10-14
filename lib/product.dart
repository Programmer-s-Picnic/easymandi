class Product {
  Product(Map<String, dynamic> json)
      : id = json['id'] as String,
        name = json['name'] as String,
        hindi = json['hindi'] as String? ?? '',
        searchKeywords = json['searchKeywords'] is List
            ? (json['searchKeywords'] as List).whereType<String>().toList(growable:false)
            : const <String>[],
        category = json['category'] as String,
        unit = json['unit'] as String,
        price = json['price'] as num,
        description = json['description'] as String? ?? '',
        emoji = json['emoji'] as String? ?? '🥬',
        available = json['available'] as bool? ?? true,
        imageUrl = _validImage(json['imageUrl'] ?? json['image']),
        compareAtPrice = _comparePrice(json['compareAtPrice'], json['price'] as num),
        mandiEnabled = json['mandi'] is Map && (json['mandi'] as Map)['enabled']==true,
        mandiQuantity = json['mandi'] is Map && (json['mandi'] as Map)['minimumQuantity'] is int
            ? (json['mandi'] as Map)['minimumQuantity'] as int : 5,
        mandiPrice = json['mandi'] is Map && (json['mandi'] as Map)['unitPrice'] is num
            ? (json['mandi'] as Map)['unitPrice'] as num : json['price'] as num;
  final String id, name, hindi, category, unit, description, emoji;
  final List<String> searchKeywords;
  final num price;
  final bool available;
  final String imageUrl;
  final num? compareAtPrice;
  final bool mandiEnabled;
  final int mandiQuantity;
  final num mandiPrice;
  static String _normaliseSearch(String value)=>value.toLowerCase().trim().replaceAll(RegExp(r'\s+'),' ');
  static String _compactSearch(String value)=>value.replaceAll(RegExp(r'[\s_-]+'),'');
  int? searchRank(String input){
    final q=_normaliseSearch(input);
    if(q.isEmpty)return 0;
    final cq=_compactSearch(q);
    final names=[name,hindi].where((s)=>s.isNotEmpty).map(_normaliseSearch).toList();
    final aliases=searchKeywords.map(_normaliseSearch).toList();
    bool exact(String v)=>v==q||_compactSearch(v)==cq;
    bool prefix(String v)=>v.startsWith(q)||_compactSearch(v).startsWith(cq);
    bool contains(String v)=>v.contains(q)||_compactSearch(v).contains(cq);
    if(names.any(exact))return 0;
    if(aliases.any(exact))return 1;
    if(names.any(prefix))return 2;
    if(aliases.any(prefix))return 3;
    if(names.any(contains))return 4;
    if(aliases.any(contains))return 5;
    if(contains(_normaliseSearch(category)))return 6;
    return null;
  }
  bool mandiActive(int quantity)=>mandiEnabled && mandiQuantity>=2 && mandiQuantity<=99 && mandiPrice>0 && mandiPrice<price && quantity>=mandiQuantity;
  num unitPrice(int quantity)=>mandiActive(quantity)?mandiPrice:price;
  num lineTotal(int quantity)=>(unitPrice(quantity)*quantity*100).round()/100;
  num mandiSavings(int quantity)=>((price-unitPrice(quantity))*quantity*100).round()/100;
  num get savings => compareAtPrice==null?0:compareAtPrice!-price;
  // Compare-at is the market price. It is a separate baseline from Mandi
  // quantity savings and already includes the Mandi reduction where active.
  num marketSavings(int quantity) {
    if (compareAtPrice==null || quantity<=0) return 0;
    final paise=((compareAtPrice!-unitPrice(quantity))*quantity*100).round();
    return paise%100==0 ? paise~/100 : paise/100;
  }

  static String _validImage(dynamic value) {
    if(value is! String || value.isEmpty) return '';
    final uri=Uri.tryParse(value);
    return uri!=null && uri.scheme=='https' && uri.host.isNotEmpty
        ? value : '';
  }
  static num? _comparePrice(dynamic value,num current) {
    if(value is! num || value<=current || value>1000000) return null;
    return value;
  }
}
