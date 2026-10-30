# Standalone client prototype (not a release)

This is a separate, unfinished client-side prototype. It does not load Netlify
and is **not yet packaged into the Android APK**. The existing Android workflow
still builds the old remote WebView wrapper; do not distribute it as this app.
The prototype currently implements sign-in, loading/creating/joining a household, creating an invitation, and a
shopping list using the current user's Supabase session. Other M1–M29 features,
account recovery and onboarding, membership management, accessibility, native
notifications, and real-device/security tests remain to be ported. Existing
Next.js code is retained for reference and the web product.

Use only the project's public publishable/anon key. Vite build-time variables
are embedded in JavaScript and are not secrets. A service-role/secret key must
never be included. Client authorization relies on Supabase RLS; re-test all
policies with separate users before using the direct client in production.

To build, set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the build
environment, then run `npm run mobile:build`. Output is `dist/mobile/` (ignored).
Missing config, secret keys and non-HTTPS origins cause the build to fail. A
successful build does not establish that login, data access, Android WebView,
or mobile device behavior has been tested. Packaging needs a secure local HTTPS
origin (e.g. AndroidX WebViewAssetLoader), tested Supabase auth persistence,
CSP, navigation, file handling and recovery/deep-link flows.
