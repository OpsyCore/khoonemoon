# Standalone client prototype (test APK, not a release)

The Android workflow builds this client into an APK using WebViewAssetLoader;
it does not load Netlify. It connects directly to Supabase using the public
publishable key and RLS. The APK is a debug-signed test build, not a market-ready
release. Android behavior and two-account data access still require real-device
testing. Documents, reminders and local notifications are integrated, but are not fully
tested on real devices. Password recovery code is integrated using PKCE, but email delivery and Android
deep links have not been tested on a real device. WorkManager background synchronization
is integrated in source but has not been tested on a real device.

Use only the project's public publishable/anon key. Vite build-time variables
are embedded in JavaScript and are not secrets. A service-role/secret key must
never be included. Client authorization relies on Supabase RLS; re-test all
policies with separate users before using the direct client in production.

To build, set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the build
environment, then run `npm run mobile:build`. Output is `dist/mobile/` (ignored).
Missing config, secret keys and non-HTTPS origins cause the build to fail. A
successful build does not establish that login, data access, Android WebView,
or mobile device behavior has been tested. Android WebView uses an HTTPS asset origin with a CSP; session persistence,
file handling, and recovery/deep-link flows still require real-device testing.


The web build includes an install manifest and a service worker for the static app
shell only. It does not cache Supabase or API data, and application functions
still need network access. HTTPS hosting and browser installation/offline behavior
need real-browser testing. Android does not depend on the web deployment.

The ZIP export includes visible document files and metadata, limited to 200 files,
12 MiB of files and 4 MiB of JSON. It fails if any file cannot be retrieved and
is not a transactional snapshot. The Android document picker and ZIP output have
not been verified on a physical device.
