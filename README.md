# Easy Mandi

## Official domain (easymandi.in)

- Customer storefront: **https://easymandi.in/**. The root `index.html` is a complete storefront with `<base href="/web/">`, so the original JS, CSS, and QR assets remain under `web/` without a redirect. Update **both** `index.html` and `web/index.html` whenever the storefront markup changes.
- Customer legacy path: `https://easymandi.in/web/`. Its canonical SEO URL also points to the root, to avoid duplicate indexing.
- Catalog and order admin: **https://easymandi.in/admin/**. Delivery admin remains separately hosted at `https://programmer-s-picnic.github.io/delivery-app/web/`; its navigation links back to the new admin domain.
- GitHub Pages custom domain is configured by the repository-root `CNAME` file. The registrar DNS must point the apex to GitHub Pages and the `www` CNAME to `programmer-s-picnic.github.io`; enable **Enforce HTTPS** in repository Pages settings after verification. Do not change mail MX/SPF records.
- Production backend API endpoints remain **https://cserver.learnwithchampak.live/easymandi/api/** and **/delivery/api/**. Both allow exact origins `https://easymandi.in`, `https://www.easymandi.in`, and `https://programmer-s-picnic.github.io`.
- The Easy Mandi Google Web OAuth client must list those three authorized JavaScript origins. The public ID is maintained in `cserver/easymandi/api/google-client-id.php`. OAuth production audience/test-user configuration and Android package signing SHA-1 must be verified separately.
- Password reset emails now open **https://easymandi.in/?reset=...** and are handled by the main customer page. Old browser-local cart and login sessions cannot transfer automatically from the GitHub Pages origin to the new domain. The server-side user/order database is unchanged.
- SEO sitemap: **https://easymandi.in/sitemap.xml**, robots: **https://easymandi.in/robots.txt**, OG cover at **https://easymandi.in/web/og-image.svg**. Admin is marked noindex.
- After changes, check browser login, Google Sign-In, COD/UPI checkout, customer delivery QR, admin catalog/orders, delivery admin, and password-reset links on the actual domain. Do not assume that a GitHub commit proves DNS, GitHub Pages HTTPS, or PHP deployment has completed.


The Flutter customer app and GitHub Pages storefront load the live product catalog from `https://cserver.learnwithchampak.live/easymandi/api/catalog.php`. The [admin website](https://easymandi.in/admin/) updates prices, availability and store settings. Flutter includes a packaged catalog for offline browsing.

## Orders

Customer checkout validates the mobile and address, then sends a basket of product IDs and quantities to `POST /easymandi/api/order-create.php`. The server uses its current catalog to calculate and store the price snapshot in MySQL, assigns an order reference, and returns the saved total. WhatsApp is an optional follow-up with that reference. Saving an order does not collect payment or mean the seller has confirmed delivery.

The admin website shows the latest 100 saved orders after the separate admin password is entered. It displays the item and address snapshots and allows status changes: New, Confirmed, Preparing, Delivered, Cancelled. Status changes are recorded in `easymandi_order_events`. Customer data stays in MySQL on cserver, not in public JSON or the GitHub repository.

A generated request key keeps retries from creating a second order. The customer website holds it in session storage until a save succeeds; Flutter retains it during the current checkout session. When a save fails, the customer can retry with the basket intact. Orders may be placed by guests; customer account registration and sign-in are optional.

## Android

The Android app stores its cart, saved addresses and recently ordered items locally in SQLite. The server order is separate from this device storage. Install the ABI-specific APK from [easymandidata](https://github.com/Programmer-s-Picnic/easymandidata). The GitHub Actions workflow builds both variants from Flutter source and publishes verified APKs through that repository.

Customer authentication uses the plain PHP API at `https://cserver.learnwithchampak.live/easymandi/api/`. Android stores its account token in secure storage; the website holds its token for the tab session. Google sign-in needs the corresponding web and Android OAuth client configuration. No SMS ownership verification or payment processing is implemented.

## Development

Run `flutter create --platforms=android --org in.easymandi .`, add Android Internet permission, then `flutter pub get` and `flutter run`. The build workflow creates the Android project and builds split APKs.


## Customer delivery code and QR

After the delivery administrator imports an Easy Mandi order and assigns a delivery partner, the delivery service issues a six-digit handoff code valid for 24 hours. The customer can sign in on the [customer website](https://easymandi.in/) and open **My deliveries · code & QR**, or tap **My deliveries · code and QR** in the Flutter app. Both views use the same authenticated delivery API and display the code and an `easymandi://handoff?delivery=ID&code=XXXXXX` QR that the partner's scanner already understands. Before assignment or after delivery/cancellation/expiry, no active QR is shown; administrators can issue a fresh code if needed. The website bundles its QR renderer locally, without sending handoff codes to third-party QR services. Customers should reveal a code only after physically receiving their order.

Customer deliveries require sign-in with a matching registered mobile. **Security limitation:** existing customer accounts currently do not verify ownership of a mobile number; before deploying this workflow for unrestricted production, add verified phone ownership or an order-specific, strongly authenticated claim mechanism to prevent a user claiming someone else's number and viewing a handoff code.

The Flutter APK build is triggered by `lib/**` changes and uploads an artifact to the **Build Easy Mandi APK** GitHub Actions workflow. That workflow does **not** automatically update `easymandidata/releases/EasyMandi-64.apk` or `EasyMandi-32.apk`; do not advertise those fixed URLs as containing the new version until the APKs have been built, checked, and uploaded separately.
