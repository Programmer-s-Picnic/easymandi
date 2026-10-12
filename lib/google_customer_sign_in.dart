import 'package:google_sign_in/google_sign_in.dart';

/// Google Sign-In 7 requires one initialization per application lifetime.
/// Both the customer login and My Account linking share this initialization.
class CustomerGoogleSignIn {
  static Future<void>? _initialization;

  static Future<GoogleSignInAccount> authenticate(String webClientId) async {
    _initialization ??= GoogleSignIn.instance.initialize(
      serverClientId: webClientId,
    );
    try {
      await _initialization;
    } catch (_) {
      _initialization = null;
      rethrow;
    }
    return GoogleSignIn.instance.authenticate();
  }

  static String safeFailure(GoogleSignInException error) {
    switch (error.code) {
      case GoogleSignInExceptionCode.clientConfigurationError:
      case GoogleSignInExceptionCode.providerConfigurationError:
        return 'Google sign-in is temporarily unavailable. Please use password sign-in or contact Easy Mandi support.';
      case GoogleSignInExceptionCode.canceled:
        return 'Google sign-in did not complete. Please try again. If it fails after choosing an account, use password sign-in or contact Easy Mandi support.';
      default:
        return 'Google sign-in error: ${error.code.name}. Try again or report this code to support.';
    }
  }
}
