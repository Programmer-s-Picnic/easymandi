# Easy Mandi

Flutter client demonstration and static web preview. Product and store settings live in [easymandidata](https://github.com/Programmer-s-Picnic/easymandidata/blob/main/catalog/products.json). The app loads that file from GitHub and uses its bundled last-known catalog if offline.

## Run

Install Flutter, then run `flutter create --platforms=android --org in.easymandi .`, add `<uses-permission android:name="android.permission.INTERNET"/>` inside the Android manifest, and run `flutter run`. The GitHub Actions workflow performs these steps and builds a release APK.

## Client demo

Browse/search products, filter by category, change quantities, review delivery and total, and share the order via WhatsApp. Checkout is an order enquiry, not a paid order. The demo leaves the WhatsApp recipient selectable; set `store.supportPhone` in the JSON to a confirmed business number before taking real orders. Prices and availability are illustrative until confirmed. The app does not collect payment or transmit addresses to Easy Mandi servers.
