import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'auth_service.dart';

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
  bool _register = false, _busy = false, _showPassword = false;
  String? _error;

  @override
  void dispose() {
    _name.dispose(); _mobile.dispose(); _email.dispose(); _login.dispose(); _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_form.currentState!.validate()) return;
    setState(() { _busy = true; _error = null; });
    try {
      final user = _register
          ? await AuthService.instance.register(
              name: _name.text, mobile: _mobile.text, email: _email.text, password: _password.text)
          : await AuthService.instance.login(login: _login.text, password: _password.text);
      if (mounted) Navigator.pop(context, user);
    } on AuthException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } catch (_) {
      if (mounted) setState(() => _error = 'Sign-in unavailable. Please try again.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(_register ? 'Create account' : 'Sign in')),
    body: Center(child: ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 480),
      child: SingleChildScrollView(padding: const EdgeInsets.all(20), child: Form(
        key: _form,
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const Icon(Icons.shopping_basket_outlined, size: 56, color: Color(0xFF176B46)),
          const SizedBox(height: 12),
          Text(_register ? 'Join Easy Mandi' : 'Welcome back',
              textAlign: TextAlign.center, style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 20),
          if (_register) ...[
            TextFormField(controller: _name, textCapitalization: TextCapitalization.words,
              decoration: const InputDecoration(labelText: 'Full name'),
              validator: (v) => (v?.trim().length ?? 0) < 2 ? 'Enter your name' : null),
            const SizedBox(height: 12),
            TextFormField(controller: _mobile, keyboardType: TextInputType.phone,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(10)],
              decoration: const InputDecoration(labelText: 'Mobile number', prefixText: '+91 ', hintText: '9876543210'),
              validator: (v) => RegExp(r'^[6-9][0-9]{9}$').hasMatch(v?.trim() ?? '') ? null : 'Enter a valid 10-digit mobile number'),
            const SizedBox(height: 12),
            TextFormField(controller: _email, keyboardType: TextInputType.emailAddress,
              decoration: const InputDecoration(labelText: 'Email (optional)'),
              validator: (v) => v == null || v.trim().isEmpty || RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(v.trim()) ? null : 'Enter a valid email'),
          ] else
            TextFormField(controller: _login, keyboardType: TextInputType.emailAddress,
              decoration: const InputDecoration(labelText: 'Mobile number or email'),
              validator: (v) => (v?.trim().isEmpty ?? true) ? 'Enter your mobile number or email' : null),
          const SizedBox(height: 12),
          TextFormField(controller: _password, obscureText: !_showPassword,
            decoration: InputDecoration(labelText: 'Password', helperText: _register ? 'At least 8 characters' : null,
              suffixIcon: IconButton(tooltip: _showPassword ? 'Hide password' : 'Show password',
                onPressed: () => setState(() => _showPassword = !_showPassword),
                icon: Icon(_showPassword ? Icons.visibility_off : Icons.visibility))),
            validator: (v) => (v?.length ?? 0) < (_register ? 8 : 1) ? 'Enter ${_register ? 'at least 8 characters' : 'your password'}' : null),
          if (_error != null) Padding(padding: const EdgeInsets.only(top: 12),
            child: Text(_error!, style: const TextStyle(color: Colors.red))),
          const SizedBox(height: 18),
          FilledButton(onPressed: _busy ? null : _submit,
            child: Padding(padding: const EdgeInsets.all(12), child: Text(_busy ? 'Please wait...' : _register ? 'Create account' : 'Sign in'))),
          TextButton(onPressed: _busy ? null : () {
            _form.currentState?.reset();
            setState(() { _register = !_register; _error = null; });
          }, child: Text(_register ? 'Already have an account? Sign in' : 'New here? Create an account')),
          const SizedBox(height: 8),
          const Text('Your account is stored on Easy Mandi’s server. Prices and orders in this demo still require confirmation.',
            textAlign: TextAlign.center),
        ]),
      )),
    )),
  );
}
