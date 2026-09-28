import 'dart:convert';
import 'dart:io';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:google_sign_in/google_sign_in.dart';

const authApiBase = 'https://cserver.learnwithchampak.live/easymandi/api';

class AuthUser {
  const AuthUser({required this.id, required this.name, required this.mobile, this.email});
  final int id;
  final String name, mobile;
  final String? email;

  factory AuthUser.fromJson(Map<String, dynamic> json) => AuthUser(
    id: (json['id'] as num).toInt(),
    name: json['name'] as String,
    mobile: json['mobile'] as String,
    email: json['email'] as String?,
  );
}

class AuthException implements Exception {
  const AuthException(this.message, [this.statusCode]);
  final String message;
  final int? statusCode;
  @override
  String toString() => message;
}

class AuthService {
  AuthService._();
  static final instance = AuthService._();
  static const _key = 'easy_mandi_auth_token';
  final _storage = const FlutterSecureStorage();
  String? _token;
  AuthUser? user;

  Future<Map<String, dynamic>> _request(String endpoint,
      {String method = 'GET', Map<String, Object?>? body, bool authenticated = false}) async {
    final client = HttpClient()..connectionTimeout = const Duration(seconds: 10);
    try {
      final url = Uri.parse('$authApiBase/$endpoint.php');
      final request = await client.openUrl(method, url).timeout(const Duration(seconds: 12));
      request.headers.set(HttpHeaders.acceptHeader, 'application/json');
      if (authenticated) {
        if (_token == null) throw const AuthException('Please sign in.');
        request.headers.set(HttpHeaders.authorizationHeader, 'Bearer $_token');
      }
      if (body != null) {
        request.headers.contentType = ContentType.json;
        request.write(jsonEncode(body));
      }
      final response = await request.close().timeout(const Duration(seconds: 15));
      final raw = await response.transform(utf8.decoder).join().timeout(const Duration(seconds: 15));
      final data = jsonDecode(raw);
      if (data is! Map<String, dynamic>) throw const AuthException('Unexpected server response.');
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw AuthException(data['error'] as String? ?? 'Request failed. Please try again.', response.statusCode);
      }
      return data;
    } on AuthException {
      rethrow;
    } on SocketException {
      throw const AuthException('Could not reach the server. Check your connection.');
    } on FormatException {
      throw const AuthException('Unexpected server response.');
    } catch (_) {
      throw const AuthException('Could not complete the request. Please try again.');
    } finally {
      client.close(force: true);
    }
  }

  Future<AuthUser?> restore() async {
    try {
      _token = await _storage.read(key: _key);
      if (_token == null) return null;
      user = AuthUser.fromJson((await _request('me', authenticated: true))['user'] as Map<String, dynamic>);
      return user;
    } on AuthException catch (error) {
      if (error.statusCode == 401) {
        await _storage.delete(key: _key);
        _token = null;
      }
      user = null;
      return null;
    }
  }

  Future<AuthUser> _startSession(Map<String, dynamic> result) async {
    final token = result['token'] as String;
    final account = AuthUser.fromJson(result['user'] as Map<String, dynamic>);
    await _storage.write(key: _key, value: token);
    _token = token;
    user = account;
    return account;
  }

  Future<AuthUser> register({required String name, required String mobile,
      required String email, required String password, required String passwordConfirmation}) async => _startSession(
        await _request('register', method: 'POST', body: {
          'name': name.trim(), 'mobile': mobile.trim(), 'email': email.trim(),
          'password': password, 'password_confirmation': passwordConfirmation,
        }),
      );

  Future<AuthUser> login({required String login, required String password}) async => _startSession(
        await _request('login', method: 'POST', body: {
          'login': login.trim(), 'password': password,
        }),
      );

  Future<String?> googleClientId() async {
    final value = (await _request('google-config'))['clientId'];
    return value is String && value.isNotEmpty ? value : null;
  }

  Future<AuthUser> googleLogin({required String idToken, String? mobile}) async => _startSession(
        await _request('google', method: 'POST', body: {
          'id_token': idToken, if (mobile != null) 'mobile': mobile.trim(),
        }),
      );

  Future<Map<String, dynamic>> createOrder(Map<String, Object?> order) =>
      _request('order-create', method: 'POST', body: order);

  Future<bool> logout() async {
    var revoked = false;
    try {
      if (_token != null) {
        await _request('logout', method: 'POST', authenticated: true);
        revoked = true;
      }
    } on AuthException {
      // Remove the token from this device even if the server is unavailable.
    } finally {
      try { await GoogleSignIn.instance.signOut(); } catch (_) { /* No Google session was active. */ }
      await _storage.delete(key: _key);
      _token = null;
      user = null;
    }
    return revoked;
  }
}
