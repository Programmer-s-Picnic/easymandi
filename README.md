# Easy Mandi

Track implementation and client tests in [FEATURES.md](FEATURES.md).

Flutter client demonstration and static web preview. Product and store settings live in [easymandidata](https://github.com/Programmer-s-Picnic/easymandidata/blob/main/catalog/products.json). The app loads that file from GitHub and uses its bundled last-known catalog if offline.

## Run

Install Flutter, then run `flutter create --platforms=android --org in.easymandi .`, add `<uses-permission android:name="android.permission.INTERNET"/>` inside the Android manifest, and run `flutter run`. The GitHub Actions workflow performs these steps and builds a release APK.

## Client demo

Browse/search products, filter by category, change quantities, review delivery and total, and share the order via WhatsApp. Checkout is an order enquiry, not a paid order. Prices and availability are illustrative until confirmed. The app does not collect payment or transmit addresses to Easy Mandi servers.

The Android app keeps basket quantities and saved delivery addresses in a device-local SQLite database. Checkout can select, edit, or delete saved addresses. The first launch after updating moves a previously saved basket from SharedPreferences into SQLite. Uninstalling or clearing app storage removes these records; they are not synchronized across devices. The static web preview uses browser storage and does not share Android's SQLite database.

The storefront also shows recently requested products with a one-tap add-again button. Items are saved locally when the app opens an order enquiry in WhatsApp. Opening WhatsApp does not prove the enquiry was sent or the order accepted; the customer confirms the order with the seller there. Products that are no longer available cannot be added again.

## Customer accounts

The Android app and website support customer registration, login, session restore and logout through the plain-PHP API at `https://cserver.learnwithchampak.live/easymandi/api/` in the `cserver` repository. Browsing and WhatsApp order enquiries remain available to guests while server access is tested. The Android session token is stored with `flutter_secure_storage`; the website holds its token for the current browser tab only. Signing out removes local basket data; Android also clears saved addresses and recently requested items to avoid exposing them to another customer on the same device. Accounts are not verified by SMS yet, and no confirmed orders are recorded by this authentication API.

Google sign-in appears after the server exposes a configured web OAuth client ID. Register the GitHub Pages origin `https://programmer-s-picnic.github.io` on that web client. Create an Android OAuth client for package `in.easymandi.easy_mandi` with the signing SHA-1 from the Android build workflow; configure the same web client ID as the app's `serverClientId`. New Google users enter a 10-digit mobile number to complete registration. Google identities do not automatically merge with password accounts sharing an email or mobile number.
