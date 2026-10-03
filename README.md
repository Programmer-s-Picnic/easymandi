# Easy Mandi

The Flutter customer app and GitHub Pages storefront load the live product catalog from `https://cserver.learnwithchampak.live/easymandi/api/catalog.php`. The [admin website](https://programmer-s-picnic.github.io/easymandi/admin/) updates prices, availability and store settings. Flutter includes a packaged catalog for offline browsing.

## Orders

Customer checkout validates the mobile and address, then sends a basket of product IDs and quantities to `POST /easymandi/api/order-create.php`. The server uses its current catalog to calculate and store the price snapshot in MySQL, assigns an order reference, and returns the saved total. WhatsApp is an optional follow-up with that reference. Saving an order does not collect payment or mean the seller has confirmed delivery.

The admin website shows the latest 100 saved orders after the separate admin password is entered. It displays the item and address snapshots and allows status changes: New, Confirmed, Preparing, Delivered, Cancelled. Status changes are recorded in `easymandi_order_events`. Customer data stays in MySQL on cserver, not in public JSON or the GitHub repository.

A generated request key keeps retries from creating a second order. The customer website holds it in session storage until a save succeeds; Flutter retains it during the current checkout session. When a save fails, the customer can retry with the basket intact. Orders may be placed by guests; customer account registration and sign-in are optional.

## Android

The Android app stores its cart, saved addresses and recently ordered items locally in SQLite. The server order is separate from this device storage. Install the ABI-specific APK from [easymandidata](https://github.com/Programmer-s-Picnic/easymandidata). The GitHub Actions workflow builds both variants from Flutter source and publishes verified APKs through that repository.

Customer authentication uses the plain PHP API at `https://cserver.learnwithchampak.live/easymandi/api/`. Android stores its account token in secure storage; the website holds its token for the tab session. Google sign-in needs the corresponding web and Android OAuth client configuration. No SMS ownership verification or payment processing is implemented.

## Development

Run `flutter create --platforms=android --org in.easymandi .`, add Android Internet permission, then `flutter pub get` and `flutter run`. The build workflow creates the Android project and builds split APKs.

## Payments

Easy Mandi supports two checkout methods:

- **Cash on Delivery (COD):** the server records the order as COD/pending. When the delivery person successfully verifies the customer's handoff code, COD is automatically marked paid.
- **UPI:** payee **ABHISHEK KUMAR SINGH**, UPI ID `7398564033@kotakbank`. The website and Android app show the order amount and UPI payment controls. Customers can upload a JPG/PNG/WebP receipt (maximum 1 MB); signed-in Android customers can also resume payment and replace a receipt from My deliveries.
- UPI receipts are stored privately in MySQL. Admin can view the receipt, verify it, or reject it. The delivery handoff action is blocked until a UPI payment is verified.
- Payment status is shown to customer, admin, delivery admin and assigned delivery partner. Manual delivery carts do not supply or override Easy Mandi payment amounts.

Payment processing is manual UPI verification; Easy Mandi does not store card details and does not claim automatic bank-side confirmation.
