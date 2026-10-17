import 'package:path/path.dart' as path;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sqflite/sqflite.dart';
import 'dart:convert';
import 'dart:async';
import 'package:flutter/foundation.dart';

class SavedAddress {
  const SavedAddress({this.id, this.isPrimary=false, required this.name, required this.phone, required this.house, required this.locality, required this.landmark, required this.pin});
  final int? id;
  final bool isPrimary;
  final String name, phone, house, locality, landmark, pin;
  factory SavedAddress.fromRow(Map<String, Object?> row) => SavedAddress(
    id: (row['id'] as num).toInt(), isPrimary: row['is_primary']==true || row['is_primary']==1,
    name: row['name'] as String, phone: row['phone'] as String,
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

  Future<Database> get database {
    final current=_opening;
    if(current!=null)return current;
    final opening=_open();
    _opening=opening;
    // Do not cache a failed SQLite open forever. Retrying must not require
    // clearing customer app data (which would risk losing saved addresses).
    opening.then<void>((_) {},onError:(Object error,StackTrace stack){
      if(identical(_opening,opening))_opening=null;
    });
    return opening;
  }

  Future<Database> _open() async {
    // Never delete or replace the database to recover from a plugin error.
    final location=path.join(await getDatabasesPath(), 'easy_mandi.db');
    final db=await openDatabase(location, version:2,
      onCreate:(database, version) async {
        await _ensureTables(database);
      },
      onUpgrade:(database, oldVersion, newVersion) async {
        await _ensureTables(database);
      },
    );
    // A prior build may already have SQLite version 2 but be missing one of
    // the optional tables. Idempotent CREATE leaves saved rows untouched.
    await _ensureTables(db);

    // Crucial: legacy SharedPreferences migration is optional. An Android
    // preference-plugin failure must NOT prevent using a healthy SQLite DB.
    await _migrateOldBasket(db).timeout(
      const Duration(seconds:2),
      onTimeout:(){
        debugPrint('Easy Mandi: legacy basket migration deferred (timeout)');
      },
    );
    return db;
  }

  static Future<void> _ensureTables(Database db) async {
    await db.execute(
      'CREATE TABLE IF NOT EXISTS cart_items '
      '(product_id TEXT PRIMARY KEY, quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 99))');
    await db.execute(
      'CREATE TABLE IF NOT EXISTS addresses '
      '(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, '
      'phone TEXT NOT NULL, house TEXT NOT NULL, locality TEXT NOT NULL, '
      'landmark TEXT NOT NULL, pin TEXT NOT NULL)');
    await db.execute(
      'CREATE TABLE IF NOT EXISTS recent_items '
      '(product_id TEXT PRIMARY KEY, name TEXT NOT NULL, unit TEXT NOT NULL, '
      'emoji TEXT NOT NULL, quantity INTEGER NOT NULL, requested_at INTEGER NOT NULL)');
  }

  Future<void> _migrateOldBasket(Database db) async {
    try {
      final prefs=await SharedPreferences.getInstance().timeout(
        const Duration(seconds:1));
      final legacy=prefs.getString('cart');
      if(legacy==null)return;
      final items=jsonDecode(legacy);
      if(items is! Map<String,dynamic>)return;
      await db.transaction((txn) async {
        for(final e in items.entries){
          if(e.value is int && (e.value as int)>=1 && (e.value as int)<=99){
            await txn.insert('cart_items',
              {'product_id':e.key,'quantity':e.value},
              conflictAlgorithm:ConflictAlgorithm.ignore);
          }
        }
      });
      // Only remove the legacy marker AFTER successful insert. Existing
      // SQLite basket items are never overwritten by this migration.
      await prefs.remove('cart');
    }catch(error){
      debugPrint('Easy Mandi: optional legacy basket migration skipped '
        '(${error.runtimeType})');
    }
  }

  Future<void> clearPreviousSales() async {
    await (await database).delete('recent_items');
  }

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
