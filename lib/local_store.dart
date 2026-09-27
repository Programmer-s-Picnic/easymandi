import 'package:path/path.dart' as path;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sqflite/sqflite.dart';
import 'dart:convert';

class SavedAddress {
  const SavedAddress({this.id, required this.name, required this.phone, required this.house, required this.locality, required this.landmark, required this.pin});
  final int? id;
  final String name, phone, house, locality, landmark, pin;
  factory SavedAddress.fromRow(Map<String, Object?> row) => SavedAddress(
    id: row['id'] as int, name: row['name'] as String, phone: row['phone'] as String,
    house: row['house'] as String, locality: row['locality'] as String,
    landmark: row['landmark'] as String, pin: row['pin'] as String,
  );
  Map<String, Object?> toRow() => {'name': name, 'phone': phone, 'house': house,
    'locality': locality, 'landmark': landmark, 'pin': pin};
}

class RecentItem {
  const RecentItem({required this.productId, required this.name, required this.unit,
    required this.emoji, required this.quantity, required this.requestedAt});
  final String productId, name, unit, emoji;
  final int quantity, requestedAt;
  factory RecentItem.fromRow(Map<String, Object?> row) => RecentItem(
    productId: row['product_id'] as String, name: row['name'] as String,
    unit: row['unit'] as String, emoji: row['emoji'] as String,
    quantity: row['quantity'] as int, requestedAt: row['requested_at'] as int,
  );
}

class LocalStore {
  LocalStore._();
  static final instance = LocalStore._();
  Future<Database>? _opening;

  Future<Database> get database => _opening ??= _open();

  Future<Database> _open() async {
    final db = await openDatabase(path.join(await getDatabasesPath(), 'easy_mandi.db'), version: 2,
      onCreate: (db, version) async {
        await db.execute('CREATE TABLE cart_items (product_id TEXT PRIMARY KEY, quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 99))');
        await db.execute('CREATE TABLE addresses (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, phone TEXT NOT NULL, house TEXT NOT NULL, locality TEXT NOT NULL, landmark TEXT NOT NULL, pin TEXT NOT NULL)');
        await _createRecentItems(db);
      },
      onUpgrade: (db, oldVersion, newVersion) async {
        if (oldVersion < 2) await _createRecentItems(db);
      });
    // Move carts saved by older app versions into SQLite once.
    final prefs = await SharedPreferences.getInstance();
    final legacy = prefs.getString('cart');
    if (legacy != null) {
      try {
        final items = jsonDecode(legacy) as Map<String, dynamic>;
        await db.transaction((txn) async {
          for (final item in items.entries) {
            if (item.value is int && item.value >= 1 && item.value <= 99) {
              await txn.insert('cart_items', {'product_id': item.key, 'quantity': item.value}, conflictAlgorithm: ConflictAlgorithm.ignore);
            }
          }
        });
        await prefs.remove('cart');
      } catch (_) { /* Keep legacy data for a future retry. */ }
    }
    return db;
  }

  static Future<void> _createRecentItems(Database db) => db.execute(
    'CREATE TABLE recent_items (product_id TEXT PRIMARY KEY, name TEXT NOT NULL, unit TEXT NOT NULL, emoji TEXT NOT NULL, quantity INTEGER NOT NULL, requested_at INTEGER NOT NULL)');

  Future<List<RecentItem>> loadRecentItems() async =>
      (await (await database).query('recent_items', orderBy: 'requested_at DESC', limit: 20))
          .map(RecentItem.fromRow).toList();

  Future<void> recordRecentItems(List<RecentItem> items) async {
    final db = await database;
    await db.transaction((txn) async {
      for (final item in items) {
        await txn.insert('recent_items', {
          'product_id': item.productId, 'name': item.name, 'unit': item.unit,
          'emoji': item.emoji, 'quantity': item.quantity,
          'requested_at': item.requestedAt,
        }, conflictAlgorithm: ConflictAlgorithm.replace);
      }
      await txn.rawDelete('DELETE FROM recent_items WHERE product_id NOT IN '
        '(SELECT product_id FROM recent_items ORDER BY requested_at DESC LIMIT 20)');
    });
  }

  Future<Map<String, int>> loadCart() async {
    final rows = await (await database).query('cart_items');
    return {for (final row in rows) row['product_id'] as String: row['quantity'] as int};
  }

  Future<void> setQuantity(String productId, int quantity) async {
    final db = await database;
    if (quantity <= 0) {
      await db.delete('cart_items', where: 'product_id = ?', whereArgs: [productId]);
    } else {
      await db.insert('cart_items', {'product_id': productId, 'quantity': quantity.clamp(1, 99)}, conflictAlgorithm: ConflictAlgorithm.replace);
    }
  }

  Future<List<SavedAddress>> loadAddresses() async =>
      (await (await database).query('addresses', orderBy: 'id DESC')).map(SavedAddress.fromRow).toList();

  Future<int> saveAddress(SavedAddress address) async {
    final db = await database;
    if (address.id == null) return db.insert('addresses', address.toRow());
    await db.update('addresses', address.toRow(), where: 'id = ?', whereArgs: [address.id]);
    return address.id!;
  }

  Future<void> deleteAddress(int id) async {
    await (await database).delete('addresses', where: 'id = ?', whereArgs: [id]);
  }

  Future<void> clearPersonalData() async {
    await (await database).transaction((txn) async {
      await txn.delete('cart_items');
      await txn.delete('addresses');
      await txn.delete('recent_items');
    });
  }
}
