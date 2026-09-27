# Easy Mandi

Flutter client demonstration and static web preview. Product and store settings live in [easymandidata](https://github.com/Programmer-s-Picnic/easymandidata/blob/main/catalog/products.json). The app loads that file from GitHub and uses its bundled last-known catalog if offline.

## Run

Install Flutter, then run `flutter create --platforms=android --org in.easymandi .`, add `<uses-permission android:name="android.permission.INTERNET"/>` inside the Android manifest, and run `flutter run`. The GitHub Actions workflow performs these steps and builds a release APK.

## Client demo

Browse/search products, filter by category, change quantities, review delivery and total, and share the order via WhatsApp. Checkout is an order enquiry, not a paid order. Prices and availability are illustrative until confirmed. The app does not collect payment or transmit addresses to Easy Mandi servers.

The Android app keeps basket quantities and saved delivery addresses in a device-local SQLite database. Checkout can select, edit, or delete saved addresses. The first launch after updating moves a previously saved basket from SharedPreferences into SQLite. Uninstalling or clearing app storage removes these records; they are not synchronized across devices. The static web preview uses browser storage and does not share Android's SQLite database.

The storefront also shows recently requested products with a one-tap add-again button. Items are saved locally when the app opens an order enquiry in WhatsApp. Opening WhatsApp does not prove the enquiry was sent or the order accepted; the customer confirms the order with the seller there. Products that are no longer available cannot be added again.
