# Easy Mandi customer app — Google Play internal testing OAuth

## Symptom

On Google Play internal testing, customer chooses an account and returns to the Easy Mandi sign-in page with Google authentication cancelled/interrupted. This can be a misreported Android Credential Manager configuration failure, not an intentional cancellation. It does **not** establish that Google sign-in has been repaired by rebuilding the AAB.

## Android OAuth identity

- Google Play app: `Easy Mandi`
- Android application ID: `in.easymandi.easy_mandi` (do not change for an existing Play app).
- Server Web OAuth client ID (public; used for the ID token audience): read from `cserver/easymandi/api/google-client-id.php`, currently `106152699344-o083fue59d1mo19si6b160gqtuap6koj.apps.googleusercontent.com`.
- Android client and Web client are **different OAuth client types**. Keep the existing Web client as `serverClientId` on Android and as the backend verifier's expected token audience.

## Fix in consoles (required; source updates cannot replace it)

1. Open **Google Play Console → Easy Mandi → Protected with Play → Play app signing** (some interfaces show this within App integrity / Release setup).
2. Copy the **App signing key certificate SHA-1**, not just the upload certificate SHA-1. On accounts with multiple Play signing certificates, register each relevant **classical** SHA-1 certificate used for delivered APKs on supported Android versions. Never copy/share private signing keys.
3. Open [Google Cloud Credentials](https://console.cloud.google.com/apis/credentials) and select the Google Cloud project containing the above Web OAuth client ID. Find it under OAuth 2.0 Client IDs.
4. Create **Credentials → OAuth client ID → Android**. Set **package name** `in.easymandi.easy_mandi` and paste the Play app signing SHA-1. Save. If an Android OAuth client with the exact package/SHA-1 already exists, verify it belongs to this Google Cloud project instead of creating duplicates.
5. Optionally register the separate **upload key SHA-1** if independently testing upload-key-signed APKs. The debug/test APK key and Play-installed app key can differ.
6. Do not paste Android client ID into server `google-client-id.php`. The server and `CustomerGoogleSignIn.authenticate` need the existing **Web OAuth client ID**.
7. If OAuth consent is in **Testing**, add the actual tester Google accounts as test users and check allowed scopes. Verify support/config if consent is in production.
8. Wait for Google OAuth credential changes to propagate, then fully close/restart the Play-installed app and retry.
9. Confirm Google account picker → successful authenticated customer session → app refresh → shopping basket/order and order history work. Password sign-in is fallback only, not evidence of Google Sign-In success.

## Build and rollout

- Customer Flutter version for next test: `1.3.19+30` (version code **30** is higher than previous 29).
- Workflow: [Build Play Store customer AAB](https://github.com/Programmer-s-Picnic/easymandi/actions/workflows/playstore-customer-aab.yml). It checks the production upload key and builds a signed AAB with API 36 target.
- Wait for a successful **new** workflow run after these edits; download the new `EasyMandi-Customer-PlayStore-AAB` artifact.
- In Google Play Console open **Internal testing → Create new release**, upload the **new** `.aab`. Do **not** re-upload or promote the older AAB version code 29.
- Review Google's checks/pre-launch report and release only to internal testers, not production, while OAuth sign-in verification is outstanding.
- Preserve both the customer and delivery partner signing keys separately.

## Useful Google references

- [Play app signing — API provider registration](https://support.google.com/googleplay/android-developer/answer/9842756)
- [Flutter Android Google Sign-In plugin — troubleshooting](https://pub.dev/packages/google_sign_in_android)
- [Google Sign-In with Android OAuth clients](https://codelabs.developers.google.com/sign-in-with-google-android)

Do not commit keystores, secret values, ID tokens, screenshots of personally identifying customer accounts, or reviewer credentials.
