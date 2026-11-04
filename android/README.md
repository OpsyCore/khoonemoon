# Android app

This Android WebView shell loads the deployed Next.js app over HTTPS. It is not
an offline/native copy: it needs the server, its API routes and Supabase. The
current default is `https://khonemoon.netlify.app`, which may be an older/broken
deployment. Before distributing, set the GitHub Actions repository variable
`ANDROID_WEB_URL` to the HTTPS origin of the tested, integrated deployment;
rebuild the APK. Changing the website URL requires rebuilding and reinstalling.
Never point it at a service-role key or a URL carrying secrets.

## Test APK

The Android APK workflow builds a debug-signed APK, downloadable from the
workflow run's `khoonemoon-test-apk` artifact (a ZIP containing the APK).
It is installable for testing, but **must not be submitted to a store**.
GitHub Actions artifacts expire and should not be used as a public app store.

## Signed release APK

Use a permanent, privately stored release keystore. Losing it may prevent future
updates. Do not commit the key or enter its contents in chat. Configure these
GitHub Actions repository **secrets** in the GitHub settings UI:

- `ANDROID_KEYSTORE_BASE64`: base64 encoding of the keystore file
- `ANDROID_KEYSTORE_PASSWORD`: keystore password
- `ANDROID_KEY_ALIAS`: signing key alias
- `ANDROID_KEY_PASSWORD`: key password

When all four are set the workflow additionally generates and verifies the
`khoonemoon-signed-release-apk` artifact. Without them, it produces only the
test APK; it does not generate or manage the user's production signing key.
Increment `versionCode` for every later release, keep the same application ID
and signing key, and test upgrades on a device before submission.

## Before store submission

Publishing to Café Bazaar requires a developer account, completed store listing,
privacy policy, compliance and review. A signed APK alone is not approval. This
is a website wrapper and does not yet implement native push notifications;
WebView behavior for background notifications must not be represented as
working. Verify sign-up, sign-in/out, private data, links, offline failure,
uploads, downloads, accessibility and security on real Android versions. The
website's document tables and end-to-end tests must also be completed. Users
may need network access to the deployed server and Supabase. The temporary
production URL and untested build must not be presented as a finished release.
