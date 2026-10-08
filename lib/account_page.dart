import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_sign_in/google_sign_in.dart';

import 'auth_service.dart';
import 'i18n.dart';

class AccountPage extends StatefulWidget {
  const AccountPage({super.key});
  @override
  State<AccountPage> createState() => _AccountPageState();
}

class _AccountPageState extends State<AccountPage> {
  final _form = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _mobile = TextEditingController();
  final _email = TextEditingController();
  final _login = TextEditingController();
  final _password = TextEditingController();
  final _confirmPassword = TextEditingController();
  bool _register = false, _busy = false, _showPassword = false;
  String? _googleClientId;
  bool _checkingGoogle=true;
  String? _error;

  void _languageChanged() {
    if (mounted) setState(() {});
  }

  @override
  void initState() {
    super.initState();
    EasyMandiLanguage.hindi.addListener(_languageChanged);
    _loadGoogleClientId();
  }

  Future<void> _loadGoogleClientId() async {
    if(mounted)setState(()=>_checkingGoogle=true);
    try{
      final id=await AuthService.instance.googleClientId();
      if(mounted)setState(()=>_googleClientId=id);
    }catch(_){
      if(mounted)setState(()=>_googleClientId=null);
    }finally{
      if(mounted)setState(()=>_checkingGoogle=false);
    }
  }

  Future<void> _googleLogin() async {
    if(_checkingGoogle)return;
    var clientId=_googleClientId;
    if(clientId==null){
      await _loadGoogleClientId();
      if(!mounted)return;
      clientId=_googleClientId;
      if(clientId==null){
        setState(()=>_error=tr(
          'Google Sign-In is not configured on the Easy Mandi server. Use password login or contact support.',
          'Easy Mandi सर्वर पर Google साइन-इन सेट नहीं है। पासवर्ड से लॉग इन करें या सहायता लें।'));
        return;
      }
    }
    setState(() { _busy = true; _error = null; });
    try {
      final google = GoogleSignIn.instance;
      await google.initialize(serverClientId: clientId);
      final account = await google.authenticate();
      final idToken = account.authentication.idToken;
      if (idToken == null) {
        throw const AuthException('Google did not return a sign-in token.');
      }
      AuthUser user;
      try {
        user = await AuthService.instance.googleLogin(idToken: idToken);
      } on AuthException catch (error) {
        if (error.statusCode != 428) rethrow;
        if (!mounted) return;
        final mobile = await _askMobile();
        if (mobile == null) return;
        user = await AuthService.instance.googleLogin(idToken: idToken, mobile: mobile);
      }
      if (mounted) Navigator.pop(context, user);
    } on GoogleSignInException catch (error) {
      if (mounted) {
        setState(() => _error = error.code == GoogleSignInExceptionCode.canceled
            ? null
            : tr('Google sign-in failed. Please try again.',
                'Google साइन-इन असफल रहा। कृपया फिर प्रयास करें।'));
      }
    } on AuthException catch (error) {
      if (mounted) setState(() => _error = localizeError(error.message));
    } catch (_) {
      if (mounted) {
        setState(() => _error = tr(
            'Google sign-in unavailable. Please try again.',
            'Google साइन-इन उपलब्ध नहीं है। कृपया फिर प्रयास करें।'));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<String?> _askMobile() async {
    final mobile = TextEditingController();
    try {
      return await showDialog<String>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: Text(tr('Complete Google registration', 'Google पंजीकरण पूरा करें')),
          content: TextField(
            controller: mobile,
            keyboardType: TextInputType.phone,
            inputFormatters: [
              FilteringTextInputFormatter.digitsOnly,
              LengthLimitingTextInputFormatter(10)
            ],
            decoration: InputDecoration(
              labelText: tr('Mobile number', 'मोबाइल नंबर'),
              prefixText: '+91 ',
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext),
              child: Text(tr('Cancel', 'रद्द करें')),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(dialogContext, mobile.text),
              child: Text(tr('Continue', 'आगे बढ़ें')),
            ),
          ],
        ),
      );
    } finally {
      mobile.dispose();
    }
  }

  @override
  void dispose() {
    EasyMandiLanguage.hindi.removeListener(_languageChanged);
    _name.dispose();
    _mobile.dispose();
    _email.dispose();
    _login.dispose();
    _password.dispose();
    _confirmPassword.dispose();
    super.dispose();
  }

  Future<void> _forgotPassword() async {
    final email=TextEditingController(text:_login.text.contains('@')?_login.text:'');
    try{
      final value=await showDialog<String>(context:context,builder:(ctx)=>AlertDialog(
        title:Text(tr('Reset password','पासवर्ड रीसेट करें')),
        content:TextField(controller:email,keyboardType:TextInputType.emailAddress,
          decoration:InputDecoration(labelText:tr('Registered email','पंजीकृत ईमेल'))),
        actions:[
          TextButton(onPressed:()=>Navigator.pop(ctx),child:Text(tr('Cancel','रद्द करें'))),
          FilledButton(onPressed:()=>Navigator.pop(ctx,email.text.trim()),child:Text(tr('Send reset link','रीसेट लिंक भेजें')))
        ],
      ));
      if(value==null||!mounted)return;
      if(!RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(value)){
        setState(()=>_error=tr('Enter a valid email address','मान्य ईमेल पता दर्ज करें'));return;
      }
      await AuthService.instance.requestPasswordReset(value);
      if(mounted)ScaffoldMessenger.of(context).showSnackBar(SnackBar(content:Text(
        tr('If the email is registered, a reset link will be sent.','ईमेल पंजीकृत है तो रीसेट लिंक भेजा जाएगा।'))));
    }on AuthException catch(error){if(mounted)setState(()=>_error=localizeError(error.message));}
    finally{email.dispose();}
  }

  Future<void> _submit() async {
    if (!_form.currentState!.validate()) return;
    setState(() { _busy = true; _error = null; });
    try {
      final user = _register
          ? await AuthService.instance.register(
              name: _name.text,
              mobile: _mobile.text,
              email: _email.text,
              password: _password.text,
              passwordConfirmation: _confirmPassword.text)
          : await AuthService.instance
              .login(login: _login.text, password: _password.text);
      if (mounted) Navigator.pop(context, user);
    } on AuthException catch (error) {
      if (mounted) setState(() => _error = localizeError(error.message));
    } catch (_) {
      if (mounted) {
        setState(() => _error = tr(
            'Sign-in unavailable. Please try again.',
            'साइन-इन उपलब्ध नहीं है। कृपया फिर प्रयास करें।'));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(
          title: Text(_register
              ? tr('Create account', 'खाता बनाएँ')
              : tr('Sign in', 'साइन इन')),
          actions: const [LanguageButton()],
        ),
        body: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 480),
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: Form(
                key: _form,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Icon(Icons.shopping_basket_outlined,
                        size: 56, color: Color(0xFF176B46)),
                    const SizedBox(height: 12),
                    Text(
                      _register
                          ? tr('Join Easy Mandi', 'Easy Mandi से जुड़ें')
                          : tr('Welcome back', 'फिर से स्वागत है'),
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.headlineSmall,
                    ),
                    const SizedBox(height: 20),
                    if (_register) ...[
                      TextFormField(
                        controller: _name,
                        textCapitalization: TextCapitalization.words,
                        decoration: InputDecoration(
                            labelText: tr('Full name', 'पूरा नाम')),
                        validator: (v) => (v?.trim().length ?? 0) < 2
                            ? tr('Enter your name', 'अपना नाम दर्ज करें')
                            : null,
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _mobile,
                        keyboardType: TextInputType.phone,
                        inputFormatters: [
                          FilteringTextInputFormatter.digitsOnly,
                          LengthLimitingTextInputFormatter(10)
                        ],
                        decoration: InputDecoration(
                          labelText: tr('Mobile number', 'मोबाइल नंबर'),
                          prefixText: '+91 ',
                          hintText: '9876543210',
                        ),
                        validator: (v) =>
                                RegExp(r'^[6-9][0-9]{9}$')
                                    .hasMatch(v?.trim() ?? '')
                            ? null
                            : tr('Enter a valid 10-digit mobile number',
                                'मान्य 10 अंकों का मोबाइल नंबर दर्ज करें'),
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _email,
                        keyboardType: TextInputType.emailAddress,
                        decoration: InputDecoration(
                            labelText:
                                tr('Email (optional)', 'ईमेल (वैकल्पिक)')),
                        validator: (v) => v == null ||
                                v.trim().isEmpty ||
                                RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$')
                                    .hasMatch(v.trim())
                            ? null
                            : tr('Enter a valid email',
                                'मान्य ईमेल दर्ज करें'),
                      ),
                    ] else
                      TextFormField(
                        controller: _login,
                        keyboardType: TextInputType.emailAddress,
                        decoration: InputDecoration(
                            labelText: tr('Mobile number or email',
                                'मोबाइल नंबर या ईमेल')),
                        validator: (v) => (v?.trim().isEmpty ?? true)
                            ? tr('Enter your mobile number or email',
                                'मोबाइल नंबर या ईमेल दर्ज करें')
                            : null,
                      ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _password,
                      obscureText: !_showPassword,
                      decoration: InputDecoration(
                        labelText: tr('Password', 'पासवर्ड'),
                        helperText: _register
                            ? tr('At least 8 characters',
                                'कम से कम 8 अक्षर')
                            : null,
                        suffixIcon: IconButton(
                          tooltip: _showPassword
                              ? tr('Hide password', 'पासवर्ड छिपाएँ')
                              : tr('Show password', 'पासवर्ड दिखाएँ'),
                          onPressed: () =>
                              setState(() => _showPassword = !_showPassword),
                          icon: Icon(_showPassword
                              ? Icons.visibility_off
                              : Icons.visibility),
                        ),
                      ),
                      validator: (v) =>
                              (v?.length ?? 0) < (_register ? 8 : 1)
                          ? (_register
                              ? tr('Enter at least 8 characters',
                                  'कम से कम 8 अक्षर दर्ज करें')
                              : tr('Enter your password',
                                  'अपना पासवर्ड दर्ज करें'))
                          : null,
                    ),
                    if (_register) ...[
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _confirmPassword,
                        obscureText: !_showPassword,
                        decoration: InputDecoration(
                            labelText: tr(
                                'Confirm password', 'पासवर्ड की पुष्टि करें')),
                        validator: (v) => v == null || v.isEmpty
                            ? tr('Confirm your password',
                                'पासवर्ड की पुष्टि करें')
                            : v != _password.text
                                ? tr('Passwords do not match',
                                    'पासवर्ड मेल नहीं खाते')
                                : null,
                      ),
                    ],
                    if (_error != null)
                      Padding(
                        padding: const EdgeInsets.only(top: 12),
                        child: Text(_error!,
                            style: const TextStyle(color: Colors.red)),
                      ),
                    const SizedBox(height: 18),
                    FilledButton(
                      onPressed: _busy ? null : _submit,
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Text(_busy
                            ? tr('Please wait...', 'कृपया प्रतीक्षा करें...')
                            : _register
                                ? tr('Create account', 'खाता बनाएँ')
                                : tr('Sign in', 'साइन इन')),
                      ),
                    ),
                    if (!_register)
                      TextButton.icon(
                        onPressed:_busy?null:_forgotPassword,
                        icon:const Icon(Icons.lock_reset),
                        label:Text(tr('Forgot password?','पासवर्ड भूल गए?')),
                      ),
                    const SizedBox(height: 12),
                    OutlinedButton.icon(
                      onPressed: _busy || _checkingGoogle ? null : _googleLogin,
                      icon: const Icon(Icons.account_circle_outlined),
                      label: Text(_checkingGoogle
                          ? tr('Checking Google Sign-In…', 'Google साइन-इन जाँच रहे हैं…')
                          : tr('Continue with Google', 'Google से आगे बढ़ें')),
                    ),
                    if (!_checkingGoogle && _googleClientId == null)
                      Padding(
                        padding: const EdgeInsets.only(top: 6),
                        child: Text(
                          tr('Google Sign-In is not configured yet. Tap the button to retry.',
                            'Google साइन-इन अभी सेट नहीं है। दोबारा कोशिश के लिए बटन दबाएँ।'),
                          textAlign: TextAlign.center,
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ),
                    TextButton(
                      onPressed: _busy
                          ? null
                          : () {
                              _form.currentState?.reset();
                              _password.clear();
                              _confirmPassword.clear();
                              setState(() {
                                _register = !_register;
                                _error = null;
                              });
                            },
                      child: Text(_register
                          ? tr('Already have an account? Sign in',
                              'पहले से खाता है? साइन इन करें')
                          : tr('New here? Create an account',
                              'नए हैं? खाता बनाएँ')),
                    ),
                    const SizedBox(height: 8),
                  ],
                ),
              ),
            ),
          ),
        ),
      );
}
