/* Easy Mandi customer storefront translations. Keeps original values, product IDs and API fields unchanged. */
(() => {
  'use strict';
  const key = 'easy-mandi-language';
  const messages = {
    en: {
      chooseLanguage:'Choose language', signIn:'Sign in', basket:'Basket', eyebrow:'FRESH FROM THE MANDI',
      heroTitle:'Good food starts fresh.', heroText:'Onions, potatoes and vegetables for your everyday kitchen · Varanasi',
      shopFresh:'Shop fresh', refreshCatalog:'Refresh catalog', searchPlaceholder:'Search onions, potatoes, tomatoes...',
      loading:'Loading catalog…', offlineCatalog:'Showing saved catalog · connect to refresh prices',
      catalogError:'Could not load catalog. Please retry.', productsCount:'{count} products · Current catalog prices',
      soldOut:'Sold out', noProducts:'No matching products.', all:'All', add:'Add', removeOne:'Remove',
      yourBasket:'Your basket', emptyBasket:'Your basket is empty.', viewDetails:'View details', viewFull:'View {name} full screen',
      remove:'Remove', removeFromBasket:'Remove {name} from basket', subtotal:'Subtotal', delivery:'Delivery',
      free:'Free', estimatedTotal:'Estimated total', deliveryNote:'Free delivery from {free} · Minimum order {minimum}',
      mobileNumber:'Mobile number', mobileHint:'Format: +91 9876543210. Enter only the 10 digits.',
      house:'House / flat / building', locality:'Street / locality', landmark:'Landmark (optional)',
      pin:'PIN code', addressFormat:'Address format:', deliveryCityLabel:'Delivery city:',
      yourName:'Your name', shareLocation:'Share current location',
      locationHint:'Optional map pin for accurate delivery. Your browser will ask for permission.',
      locationUnavailable:'Location is unavailable on this device.', locationFinding:'Finding your location…',
      locationAttached:'Location attached. Check the pin: {coords}',
      locationDenied:'Location permission was denied or unavailable. You can still place the order.',
      paymentMethod:'Payment method', cod:'Cash on Delivery', upiMethod:'UPI / QR payment',
      upiHint:'For UPI, the exact saved order total is used. Upload the payment screenshot/receipt after paying so the admin can verify it.',
      close:'Close', placeOrder:'Place order', placingOrder:'Placing order…', quantity:'Quantity',
      itemTotal:'Item total: {amount}', detailClose:'Close product details',
      minimumError:'Minimum order is {minimum}. Add {difference} more.',
      mobileError:'Enter a 10-digit Indian mobile number starting with 6, 7, 8 or 9',
      pinError:'Enter a valid 6-digit Indian PIN code', addressError:'Enter a valid house/building and street/locality.',
      serverUnexpected:'Unexpected server response. Please retry.',
      orderFailure:'Could not place order. Please retry.',
      orderPlaced:'Order placed · {id}', savedTotal:'Saved total: {total}. {method}',
      upiSelected:'UPI payment selected. Pay only this exact amount.', codSelected:'Cash on Delivery selected.',
      upiPayment:'UPI payment', payInfo:'Pay {total} to {name} · {upi}', openUpi:'Open UPI app',
      upiReference:'UPI transaction/reference (optional)', receiptHint:'Upload a JPG, PNG or WebP receipt under 1 MB.',
      submitReceipt:'Submit payment receipt', chooseReceipt:'Choose your payment screenshot first.',
      receiptSize:'Receipt must be smaller than 1 MB.', receiptType:'Use JPG, PNG or WebP.',
      uploadingReceipt:'Uploading receipt…', receiptSubmitted:'Receipt submitted. Payment status: Submitted for verification.',
      receiptSubmittedButton:'Receipt submitted', sendWhatsapp:'Send reference on WhatsApp',
      accountTitle:'Sign in', fullName:'Full name', loginLabel:'Mobile number or email',
      password:'Password', confirmPassword:'Confirm password', createAccount:'Create an account',
      createAccountAction:'Create account', alreadyAccount:'Already registered? Sign in',
      completeGoogle:'Complete Google sign-in', myAccount:'My account', hiUser:'Hi, {name}',
      signOut:'Sign out', signOutNotice:'Signing out removes the basket from this browser.',
      accountGoogleMobile:'Enter your mobile number, then choose Complete Google sign-in.',
      passwordsMismatch:'Passwords do not match.',
      savedAddresses:'Saved addresses', chooseAddress:'Choose saved address',
      saveAddress:'Save address to my account', deleteAddress:'Delete saved address',
      newAddress:'Use a new address', previouslyOrdered:'Previously ordered items',
      noPrevious:'Your ordered items will appear here.', unavailable:'Unavailable',
      savedAddressOk:'Address saved to your account.', deletedAddressOk:'Address deleted.',
      deleteAddressQuestion:'Delete this saved address from your account?',
      addressLoadError:'Could not load saved addresses.', customerFooter:'Easy Mandi · Varanasi',
      welcomeWhatsapp:'Hello Easy Mandi, my order {id} has been placed.'
    },
    hi: {
      chooseLanguage:'भाषा चुनें', signIn:'लॉग इन', basket:'टोकरी', eyebrow:'मंडी से सीधे आपके घर',
      heroTitle:'ताज़ी सब्ज़ियाँ, बेहतर भोजन।', heroText:'आपकी रसोई के लिए प्याज़, आलू और ताज़ी सब्ज़ियाँ · वाराणसी',
      shopFresh:'ताज़ी सब्ज़ियाँ खरीदें', refreshCatalog:'सामान अपडेट करें', searchPlaceholder:'प्याज़, आलू, टमाटर खोजें...',
      loading:'सामान की सूची लोड हो रही है…', offlineCatalog:'सहेजी गई सूची दिखाई जा रही है · नए दामों के लिए इंटरनेट जोड़ें',
      catalogError:'सामान की सूची नहीं खुली। दोबारा कोशिश करें।', productsCount:'{count} उत्पाद · वर्तमान सूची के दाम',
      soldOut:'उपलब्ध नहीं', noProducts:'कोई मेल खाने वाला उत्पाद नहीं मिला।', all:'सभी', add:'जोड़ें', removeOne:'घटाएँ',
      yourBasket:'आपकी टोकरी', emptyBasket:'आपकी टोकरी खाली है।', viewDetails:'विवरण देखें', viewFull:'{name} का पूरा विवरण देखें',
      remove:'हटाएँ', removeFromBasket:'टोकरी से {name} हटाएँ', subtotal:'सामान का कुल', delivery:'डिलीवरी',
      free:'मुफ़्त', estimatedTotal:'अनुमानित कुल', deliveryNote:'{free} से ऊपर मुफ़्त डिलीवरी · न्यूनतम ऑर्डर {minimum}',
      mobileNumber:'मोबाइल नंबर', mobileHint:'प्रारूप: +91 9876543210। केवल 10 अंक भरें।',
      house:'मकान / फ्लैट / भवन', locality:'सड़क / मोहल्ला', landmark:'पहचान की जगह (वैकल्पिक)',
      pin:'पिन कोड', addressFormat:'पते का प्रारूप:', deliveryCityLabel:'डिलीवरी शहर:',
      yourName:'आपका नाम', shareLocation:'अपना स्थान साझा करें',
      locationHint:'सही डिलीवरी के लिए स्थान जोड़ सकते हैं। ब्राउज़र अनुमति माँगेगा।',
      locationUnavailable:'इस डिवाइस पर स्थान उपलब्ध नहीं है।', locationFinding:'आपका स्थान खोज रहे हैं…',
      locationAttached:'स्थान जुड़ गया। नक्शे के निर्देशांक: {coords}',
      locationDenied:'स्थान की अनुमति नहीं मिली। फिर भी ऑर्डर कर सकते हैं।',
      paymentMethod:'भुगतान का तरीका', cod:'डिलीवरी पर नकद', upiMethod:'यूपीआई / क्यूआर भुगतान',
      upiHint:'यूपीआई में सहेजे गए ऑर्डर की सही राशि चुकाएँ। भुगतान की रसीद अपलोड करें ताकि व्यवस्थापक जाँच सके।',
      close:'बंद करें', placeOrder:'ऑर्डर करें', placingOrder:'ऑर्डर भेज रहे हैं…', quantity:'मात्रा',
      itemTotal:'इस वस्तु का कुल: {amount}', detailClose:'उत्पाद विवरण बंद करें',
      minimumError:'न्यूनतम ऑर्डर {minimum} है। {difference} का सामान और जोड़ें।',
      mobileError:'6, 7, 8 या 9 से शुरू होने वाला 10 अंकों का मोबाइल नंबर डालें',
      pinError:'6 अंकों का सही भारतीय पिन कोड डालें', addressError:'मकान और मोहल्ले का सही पता डालें।',
      serverUnexpected:'सर्वर से सही जवाब नहीं मिला। फिर कोशिश करें।',
      orderFailure:'ऑर्डर नहीं हो पाया। फिर कोशिश करें।',
      orderPlaced:'ऑर्डर दर्ज हुआ · {id}', savedTotal:'सहेजी गई कुल राशि: {total}। {method}',
      upiSelected:'यूपीआई चुना गया। केवल इसी राशि का भुगतान करें।', codSelected:'डिलीवरी पर नकद भुगतान चुना गया।',
      upiPayment:'यूपीआई भुगतान', payInfo:'{name} · {upi} को {total} भेजें', openUpi:'यूपीआई ऐप खोलें',
      upiReference:'यूपीआई लेनदेन / संदर्भ संख्या (वैकल्पिक)', receiptHint:'1 MB से छोटी JPG, PNG या WebP रसीद अपलोड करें।',
      submitReceipt:'भुगतान रसीद भेजें', chooseReceipt:'पहले भुगतान की रसीद चुनें।',
      receiptSize:'रसीद 1 MB से छोटी होनी चाहिए।', receiptType:'JPG, PNG या WebP चुनें।',
      uploadingReceipt:'रसीद अपलोड हो रही है…', receiptSubmitted:'रसीद भेज दी गई है। भुगतान जाँच के लिए भेजा गया है।',
      receiptSubmittedButton:'रसीद भेज दी गई', sendWhatsapp:'व्हाट्सऐप पर ऑर्डर संदर्भ भेजें',
      accountTitle:'लॉग इन', fullName:'पूरा नाम', loginLabel:'मोबाइल नंबर या ईमेल',
      password:'पासवर्ड', confirmPassword:'पासवर्ड की पुष्टि करें', createAccount:'नया खाता बनाएँ',
      createAccountAction:'खाता बनाएँ', alreadyAccount:'पहले से खाता है? लॉग इन करें',
      completeGoogle:'गूगल से लॉग इन पूरा करें', myAccount:'मेरा खाता', hiUser:'नमस्ते, {name}',
      signOut:'लॉग आउट', signOutNotice:'लॉग आउट करने पर इस ब्राउज़र की टोकरी खाली हो जाएगी।',
      accountGoogleMobile:'मोबाइल नंबर डालकर गूगल लॉग इन पूरा करें दबाएँ।',
      passwordsMismatch:'दोनों पासवर्ड समान नहीं हैं।',
      savedAddresses:'सहेजे हुए पते', chooseAddress:'सहेजा पता चुनें',
      saveAddress:'पता अपने खाते में सहेजें', deleteAddress:'सहेजा पता हटाएँ',
      newAddress:'नया पता दर्ज करें', previouslyOrdered:'पहले मँगाए गए उत्पाद',
      noPrevious:'पहले मँगाए हुए उत्पाद यहाँ दिखेंगे।', unavailable:'उपलब्ध नहीं',
      savedAddressOk:'पता आपके खाते में सहेज दिया गया है।', deletedAddressOk:'पता हटा दिया गया।',
      deleteAddressQuestion:'क्या अपने खाते से यह पता हटाना चाहते हैं?',
      addressLoadError:'सहेजे हुए पते नहीं खुल पाए।', customerFooter:'ईज़ी मंडी · वाराणसी',
      welcomeWhatsapp:'नमस्ते ईज़ी मंडी, मेरा ऑर्डर {id} दर्ज हो गया है।'
    }
  };
  let lang;
  try { lang = localStorage.getItem(key) === 'hi' ? 'hi' : 'en'; } catch { lang = 'en'; }
  const t=(id,vars={}) => {
    const phrase=(messages[lang][id] || messages.en[id] || id);
    return phrase.replace(/\\{([a-zA-Z]+)\\}/g,(_,k)=>String(vars[k] ?? ''));
  };
  function apply() {
    document.documentElement.lang=lang;
    document.querySelectorAll('[data-i18n]').forEach(node=> { node.textContent=t(node.dataset.i18n); });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(node=> { node.placeholder=t(node.dataset.i18nPlaceholder); });
    document.querySelectorAll('[data-i18n-title]').forEach(node=> { node.title=t(node.dataset.i18nTitle); });
    const picker=document.getElementById('siteLanguage');
    if(picker) picker.value=lang;
  }
  function set(next) {
    if(next!=='en' && next!=='hi') return;
    lang=next;
    try { localStorage.setItem(key,lang); } catch {}
    apply();
    window.dispatchEvent(new CustomEvent('languagechange',{detail:{lang}}));
  }
  window.EMI18n={t,set,apply,get lang(){return lang;}};
  document.addEventListener('DOMContentLoaded',()=>{
    apply();
    document.getElementById('siteLanguage')?.addEventListener('change',event=>set(event.target.value));
  });
})();
