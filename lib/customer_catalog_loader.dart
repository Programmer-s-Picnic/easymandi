import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/services.dart';

/// Never hold the catalogue spinner indefinitely while a slow PHP response
/// streams headers or an incomplete body. Keep offline browsing available.
class CustomerCatalogLoader {
  CustomerCatalogLoader._();

  static const Duration defaultNetworkDeadline=Duration(seconds:9);
  static const String _endpoint='https://cserver.learnwithchampak.live/easymandi/api/catalog.php';

  static Future<String> load({
    Uri? remote,
    Duration networkDeadline=defaultNetworkDeadline,
    Future<String> Function()? offline,
  }) async {
    final fallback=offline??()=>rootBundle.loadString('assets/products.json');
    final client=HttpClient()..connectionTimeout=const Duration(seconds:7);
    try {
      Future<String> download() async {
        final request=await client.getUrl(remote??Uri.parse(_endpoint));
        final response=await request.close();
        if(response.statusCode!=HttpStatus.ok){
          throw HttpException('Catalog unavailable: ${response.statusCode}');
        }
        // This read must share the same overall network deadline as DNS and
        // response headers: a PHP streaming body may otherwise never close.
        final raw=await response.transform(utf8.decoder).join();
        final data=jsonDecode(raw);
        if(data is! Map<String,dynamic> || data['products'] is! List ||
            data['store'] is! Map || data['categories'] is! List){
          throw const FormatException('Invalid remote catalog');
        }
        return raw;
      }
      return await download().timeout(networkDeadline);
    } catch (_) {
      // Stored local product list is bundled with the APK and needs no network.
      // Server still authoritatively validates prices and orders on checkout.
      return fallback();
    } finally {
      client.close(force:true);
    }
  }
}
