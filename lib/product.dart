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
        available = json['available'] as bool? ?? true;
  final String id, name, hindi, category, unit, description, emoji;
  final num price;
  final bool available;
}
