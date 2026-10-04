import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

class EasyMandiLanguage {
  EasyMandiLanguage._();

  static const _prefKey = 'easy_mandi_language';
  static final ValueNotifier<bool> hindi = ValueNotifier<bool>(false);

  static Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    hindi.value = prefs.getString(_prefKey) == 'hi';
  }

  static Future<void> setHindi(bool value) async {
    hindi.value = value;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_prefKey, value ? 'hi' : 'en');
  }

  static Future<void> toggle() => setHindi(!hindi.value);
}

String tr(String english, String hindi) =>
    EasyMandiLanguage.hindi.value ? hindi : english;

String categoryText(String value) {
  if (!EasyMandiLanguage.hindi.value) return value;
  const labels = {
    'All': 'सभी',
    'Vegetables': 'सब्ज़ियाँ',
    'Leafy greens': 'हरी पत्तेदार सब्ज़ियाँ',
    'Essentials': 'ज़रूरी सामान',
    'Fruits': 'फल',
    'Grocery': 'किराना',
    'Groceries': 'किराना',
  };
  return labels[value] ?? value;
}

String statusText(String value) {
  if (!EasyMandiLanguage.hindi.value) return value.replaceAll('_', ' ');
  const labels = {
    'created': 'बनाया गया',
    'assigned': 'डिलीवरी पार्टनर तय',
    'picked_up': 'सामान लिया गया',
    'out_for_delivery': 'डिलीवरी के लिए निकला',
    'delivered': 'डिलीवर हो गया',
    'cancelled': 'रद्द',
    'New': 'नया',
    'Confirmed': 'पुष्ट',
    'Preparing': 'तैयार हो रहा है',
    'Delivered': 'डिलीवर हो गया',
    'Cancelled': 'रद्द',
    'pending': 'लंबित',
    'submitted': 'जाँच के लिए भेजा',
    'verified': 'सत्यापित',
    'paid': 'भुगतान हो गया',
    'rejected': 'अस्वीकृत',
  };
  return labels[value] ?? value.replaceAll('_', ' ');
}

String productName(String english, String hindi) {
  if (EasyMandiLanguage.hindi.value && hindi.trim().isNotEmpty) return hindi;
  return english;
}

String productDescription(String english) {
  if (!EasyMandiLanguage.hindi.value) return english;
  const labels = {
    'Everyday kitchen onions': 'रोज़मर्रा की रसोई के लिए प्याज',
    'Fresh potatoes for daily cooking': 'रोज़ के भोजन के लिए ताज़े आलू',
    'Ripe, versatile tomatoes': 'पके और बहुउपयोगी टमाटर',
    'Crisp seasonal carrots': 'कुरकुरी मौसमी गाजर',
    'Fresh whole cauliflower': 'ताज़ी पूरी फूलगोभी',
    'Firm and fresh cabbage': 'ताज़ी और कसी हुई पत्तागोभी',
    'Fresh leafy spinach': 'ताज़ा हरा पालक',
    'Fragrant coriander leaves': 'सुगंधित हरा धनिया',
    'Add a fresh kick to meals': 'भोजन में ताज़ा तीखापन जोड़ें',
    'Fresh ginger for cooking and tea': 'खाना और चाय के लिए ताज़ा अदरक',
    'Aromatic garlic bulbs': 'सुगंधित लहसुन',
  };
  return labels[english] ?? english;
}

String localizeError(String message) {
  if (!EasyMandiLanguage.hindi.value) return message;
  const exact = {
    'Please sign in.': 'कृपया साइन इन करें।',
    'Could not reach the server. Check your connection.': 'सर्वर से संपर्क नहीं हो सका। अपना इंटरनेट कनेक्शन जाँचें।',
    'Unexpected server response.': 'सर्वर से अप्रत्याशित उत्तर मिला।',
    'Could not complete the request. Please try again.': 'अनुरोध पूरा नहीं हो सका। कृपया फिर प्रयास करें।',
    'Google sign-in unavailable. Please try again.': 'Google साइन-इन उपलब्ध नहीं है। कृपया फिर प्रयास करें।',
    'Sign-in unavailable. Please try again.': 'साइन-इन उपलब्ध नहीं है। कृपया फिर प्रयास करें।',
    'Enter a valid 10-digit mobile number': 'मान्य 10 अंकों का मोबाइल नंबर दर्ज करें',
    'Enter your mobile number to complete Google registration': 'Google पंजीकरण पूरा करने के लिए मोबाइल नंबर दर्ज करें',
  };
  return exact[message] ?? message;
}

class LanguageButton extends StatelessWidget {
  const LanguageButton({super.key});

  @override
  Widget build(BuildContext context) => TextButton(
        onPressed: EasyMandiLanguage.toggle,
        child: Text(
          EasyMandiLanguage.hindi.value ? 'EN' : 'हिन्दी',
          style: const TextStyle(fontWeight: FontWeight.w800),
        ),
      );
}
