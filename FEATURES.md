# Easy Mandi feature and verification checklist

Updated 27 September 2026. This tracks the **Flutter Android app**. The static web preview has separate browser storage and does not implement every Android feature.

**How to tick:** `Built` means the feature exists in the source and the latest Android build passed Flutter analysis. `Phone verified` means someone exercised the acceptance check on an installed APK. Do not tick a phone check merely because CI built an APK. For new items, tick Built after code review and a passing build, then Phone verified after a real device test. Record the device, date, and result below.

| ID | Feature and acceptance check | Built | Phone verified |
|---|---|:---:|:---:|
| F01 | JSON catalog: app loads the public catalog; all 11 demo products, units and prices display. | [x] | [ ] |
| F02 | Offline fallback: with network disabled, bundled catalog appears and offline notice is shown. | [x] | [ ] |
| F03 | Search and categories: find a product by name/Hindi text and filter by category. | [x] | [ ] |
| F04 | Availability: unavailable products cannot be added to the basket. | [x] | [ ] |
| F05 | Basket: add, reduce and remove quantities; subtotal, delivery and minimum-order rule update correctly. | [x] | [ ] |
| F06 | SQLite basket: force-close and reopen; quantities remain; older SharedPreferences basket migrates once. | [x] | [ ] |
| F07 | Checkout input: enforce name, Indian 10-digit mobile, house/building, locality and six-digit PIN; landmark optional. | [x] | [ ] |
| F08 | Saved addresses: add, select, edit and delete locally; reopen app and confirm persistence. | [x] | [ ] |
| F09 | WhatsApp enquiry: message includes exact items, quantities, totals, contact and delivery address; failed launch copies message. Opening WhatsApp does **not** confirm an order. | [x] | [ ] |
| F10 | Recently ordered items: after opening an enquiry, local list shows requested products; add-again works; unavailable items stay disabled. List describes its enquiry-based status. | [x] | [ ] |
| F11 | Credit: About and storefront display Champak Roy; website link opens learnwithchampak.live. | [x] | [ ] |
| F12 | Two Android APKs: ARM64 and 32-bit files at the published links install and launch on suitable devices. | [x] | [ ] |
| F13 | Web preview: public JSON, search, categories, basket and validated enquiry work in a mobile browser. | [x] | [ ] |
| F14 | Configure the actual Easy Mandi WhatsApp business number in the JSON catalog; verify the enquiry reaches that exact account. The current `supportPhone` is empty. | [ ] | [ ] |
| F15 | Confirm service area, vegetable prices, units, minimum order, delivery fee and free-delivery threshold with the client; replace illustrative data. | [ ] | [ ] |
| F16 | Order confirmation: record a true order ID/status only after an acknowledgement from the seller or a future order backend. Do not treat opening WhatsApp as a completed order. | [ ] | [ ] |
| F17 | Order history: show actual confirmed orders, item snapshots, totals and statuses; keep enquiries distinguishable. | [ ] | [ ] |
| F18 | Product photos, produce quality/weight notes and substitutions: client-approved assets and clear unit descriptions. | [ ] | [ ] |
| F19 | Delivery slot, coverage and charges: validate PIN/service area and show a realistic delivery window before enquiry. | [ ] | [ ] |
| F20 | Reorder: add all currently available items from a previous confirmed order, show changed prices and missing items before checkout. | [ ] | [ ] |
| F21 | Customer support and policies: contact details, cancellation/refund/return and privacy information approved by the client. | [ ] | [ ] |
| F22 | Web and Android parity: decide which saved address, recent-item and order features the website needs, then verify each in a browser. | [ ] | [ ] |
| F23 | Accessibility and device QA: text scaling, TalkBack labels, small screens, keyboard, offline errors and slow network. | [ ] | [ ] |
| F24 | Release readiness: production application ID, versioning, durable signing key, upgrade over the prior install and checksum-verified public downloads. | [ ] | [ ] |

## Gates already checked

- [x] Flutter analysis and split release APK build passed on [GitHub Actions run 36289253807](https://github.com/Programmer-s-Picnic/easymandi/actions/runs/36289253807).
- [x] Both APKs were published to `easymandidata/releases` with SHA-256 checks; repository blob hashes matched the build artifact on 27 September 2026.
- [ ] Android installation, update-over-old-install, offline flow, checkout and persistence tested on a physical phone.
- [ ] Client supplies and approves actual WhatsApp number, prices, delivery rules and service area.

## Phone test record

| Date | Device / Android version | Tester | IDs checked | Result / issue link |
|---|---|---|---|---|
| — | — | — | — | Awaiting device test |

## Current client downloads

- [64-bit Android APK](https://raw.githubusercontent.com/Programmer-s-Picnic/easymandidata/main/releases/EasyMandi-arm64-v1.apk)
- [32-bit Android APK](https://raw.githubusercontent.com/Programmer-s-Picnic/easymandidata/main/releases/EasyMandi-armeabi-v7a-v1.apk)
