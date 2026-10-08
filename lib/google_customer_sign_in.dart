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
        return 'Google authentication setup error (${error.code.name}). Check Android package, SHA-1 and Web Client ID.';
      case GoogleSignInExceptionCode.canceled:
        return 'Google account selection was cancelled or interrupted. If this appeared after choosing your account, check Android OAuth registration (SHA-1 and package name).';
      default:
        return 'Google sign-in error: ${error.code.name}. Try again or report this code to support.';
    }
  }
}
