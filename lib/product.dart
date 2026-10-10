class Product {
  Product(Map<String, dynamic> json)
      : id = json['id'] as String,
        name = json['name'] as String,
        hindi = json['hindi'] as String? ?? '',
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
  final num price;
  final bool available;
  final String imageUrl;
  final num? compareAtPrice;
  final bool mandiEnabled;
  final int mandiQuantity;
  final num mandiPrice;
  bool mandiActive(int quantity)=>mandiEnabled && mandiQuantity>=2 && mandiQuantity<=99 && mandiPrice>0 && mandiPrice<price && quantity>=mandiQuantity;
  num unitPrice(int quantity)=>mandiActive(quantity)?mandiPrice:price;
  num lineTotal(int quantity)=>(unitPrice(quantity)*quantity*100).round()/100;
  num mandiSavings(int quantity)=>((price-unitPrice(quantity))*quantity*100).round()/100;
  num get savings => compareAtPrice==null?0:compareAtPrice!-price;

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
