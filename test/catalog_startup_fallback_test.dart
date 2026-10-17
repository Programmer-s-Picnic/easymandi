import 'dart:async';
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:easy_mandi/customer_catalog_loader.dart';

void main(){
  const bundled='{"products":[],"store":{"name":"Easy Mandi"},"categories":["All"]}';
  test('A stalled catalog body falls back without hanging the startup spinner',()async{
    final server=await HttpServer.bind(InternetAddress.loopbackIPv4,0);
    final requests=<HttpRequest>[];
    final subscription=server.listen((request)async{
      requests.add(request);
      request.response.statusCode=200;
      request.response.write('{"products":[');
      await request.response.flush();
      // Deliberately keep this body stream open until the deadline expires.
    });
    try{
      final result=await CustomerCatalogLoader.load(
        remote:Uri.parse('http://127.0.0.1:${server.port}/catalog'),
        networkDeadline:const Duration(milliseconds:350),
        offline:()async=>bundled,
      ).timeout(const Duration(seconds:3));
      expect(result,bundled);
      expect(requests,isNotEmpty);
    }finally{
      await subscription.cancel();
      await server.close(force:true);
    }
  });
  test('Invalid remote catalog does not trap the app in an empty loading screen',()async{
    final server=await HttpServer.bind(InternetAddress.loopbackIPv4,0);
    final subscription=server.listen((request)async{
      request.response.headers.contentType=ContentType.json;
      request.response.write('{"wrong":true}');
      await request.response.close();
    });
    try{
      final result=await CustomerCatalogLoader.load(
        remote:Uri.parse('http://127.0.0.1:${server.port}/catalog'),
        networkDeadline:const Duration(seconds:2),
        offline:()async=>bundled,
      );
      expect(result,bundled);
    }finally{
      await subscription.cancel();
      await server.close(force:true);
    }
  });
}
