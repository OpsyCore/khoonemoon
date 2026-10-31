# Integrating the paper redesign

The paper redesign lives on `arena/01a05828-khoonemoon` (tip `0543138`). It diverged from `main`: it is not a newer superset of main. Do not deploy it against the current database as a workaround.

The integration starts from main (`8b72c84`) to retain the later finance, reminders, summaries and export work. Port UI changes incrementally rather than replacing server code wholesale. The shared paper tokens, button, card and input styles are the first slice; retain React 19 ref forwarding and generated input IDs. Screen layouts, navigation, dialogs and accessibility still require integration and browser testing.

## Shopping schema mismatch

Inspection of the live `khoonemoon` database on 2026-10-30 shows `shopping_lists.archived_at` (not `is_active`). Its `shopping_items` columns include `added_by`, `purchased`, `purchased_by`, and `purchased_at`, not the redesigned branch's `created_by`, `is_checked`, `checked_by`, and `checked_at`. The main branch's shopping API uses the live schema. Adding a single `is_active` column would therefore not fix the redesigned branch and could produce conflicting data models. Preserve current data and RLS; do not apply the other branch's shopping migration blindly.

Documents routes, UI and adapted migrations have been ported and applied to the connected Supabase project. The local RLS suite covers private/shared document and storage isolation and finance attachment access. Before release: port remaining screen layouts, verify document upload/download and authenticated journeys against a safe environment, and validate mobile UI. Review branch-specific settings and make the eventual Netlify production branch point to the integrated version only after verification.

## Direct mobile schedule transport

Migrations `0013_mobile_atomic_create.sql` and `0014_mobile_atomic_update.sql`
were applied to the connected Supabase project on 2026-10-31 after local and CI
Postgres/RLS checks. Both expose SECURITY INVOKER functions only to authenticated
users. Metadata confirms anon cannot execute them. Real two-account and Android
tests are still outstanding. The standalone mobile client is packaged into the Android test APK. Its task recurrence fields preserve the existing model;
automatic creation of the next task on completion uses migration `0015_recurring_task_completion.sql` applied to Supabase. It is tested locally and in CI, but not yet with real accounts or on Android. The mobile calendar has month, week and agenda views, pending real-device testing.

### Mobile shopping and finance

The independent mobile UI includes shopping and financial record flows using the current user's JWT and RLS. The finance realtime publication migration `0016_finance_realtime.sql` has been applied to project `isfzuxrkzeeeggvfcoah`; shopping lists, shopping items, and financial records are in `supabase_realtime`. A foreground and periodic refresh covers missed events, including deletes. Realtime delivery and the interface have not yet been exercised end-to-end with two real accounts or on Android. Reports and settlement are restricted to the chosen currency; settlement is an estimate for current household members, not a recorded payment. Financial recurrence is only a flag and does not create future records. The independent mobile UI is packaged in the Android wrapper. The user-facing Android build and real-device testing remain in the integration phase.

### Document screen and database deployment

The mobile document screen includes category filtering, user-scoped upload, short-lived signed URLs, metadata editing, deletion and entity links. Production project `isfzuxrkzeeeggvfcoah` has the documents and document_category migrations applied; tables have RLS enabled and the private documents bucket has scoped policies. Database RLS assertions and client mock tests pass, but actual Storage upload/download, Android file chooser, sharing and two-user isolation have not been tested on real devices. Deletion is two-step: metadata deletion is confirmed first, then the file is deleted. An uncertain database response keeps the file; a storage failure may leave an unreferenced file and is reported. ZIP export now includes visible document files within explicit limits; device verification is still pending. Background Android reminder notifications and complete final integration remain open.

### Android local reminder alarms

The Android client can schedule already-synced active reminders locally using AlarmManager, notification permission and a single alarm. Only user ID, reminder IDs and timestamps are kept on device; no tokens or titles cross the native bridge. Alarms are cleared at sign-out/account change and re-scheduled after reboot or time changes. Quiet hours are calculated in device time during sync; inexact alarms may be delayed by the operating system. The previous released test APK only syncs on startup, foreground and periodically while open. A newer WorkManager implementation exists in source but has not been tested on a device. Force-stop, permissions, battery optimizations, reboot, timezone changes, Storage/file handling, and actual delivery have not been tested on a physical Android device. These local alarms are not a replacement for authenticated background sync or native push.

When the Android app is visible, reminder and preference changes also trigger an RLS-scoped refresh through Supabase Realtime (migration 0018); periodic foreground polling remains the fallback. Realtime alone cannot deliver updates to the scheduler after the app is closed; periodic WorkManager sync has been added in source but is not device-verified. Android APK builds are manually triggered only; normal pushes do not build an APK.

The scoped device credential migrations 0019 and 0021 have been applied to the connected Supabase project; Android device testing and end-to-end delivery verification are still outstanding.

### Password recovery

The standalone client requests PKCE recovery links and Android handles the custom `app.khoonemoon.mobile://recovery` URI. Supabase's redirect allowlist includes it. Recovery links must be opened on the same device/app that initiated the request. Only helper tests have run: Android deep-link delivery, browser recovery, SMTP and real email flows remain untested. The Supabase project currently has no custom SMTP configured, so the default service has delivery restrictions and is not suitable for general production recovery.

Migration 0020 tightens document metadata inserts so private records must use their owner's storage prefix and shared records their household prefix. Applied to `isfzuxrkzeeeggvfcoah` after verifying there were no existing mismatched records; CI-style RLS assertions cover both valid and invalid paths. Real Storage API and multi-device tests are still required.

Document uploads deliberately retain the uploaded object if metadata insertion has an uncertain outcome: a read immediately after a timeout can race an in-flight commit, so deleting even after an empty read risks data loss. This can leave unreferenced private storage objects; a safe orphan-reconciliation process is still needed. Storage SELECT and write isolation are tested against the local database shim, not the real Storage API.

A candidate Android WorkManager implementation now uses a 15-minute-or-longer polling interval and a separate 30-day read-only device credential encrypted with Android Keystore; this is not Firebase and does not provide instant delivery. Local account data and scheduled work are cleared on sign-out; server revocation is best-effort if offline. The scoped-credential migrations 0019 and 0021 were applied after automated RLS and compile checks; no APK has been produced for this code. Force-stop, Doze, permission, reboot, device clock/timezone, failed network and actual two-device delivery still need real Android testing. System scheduling and network may delay or prevent polling; newly discovered reminders more than 24 hours overdue are not notified.

A password change invalidates previously registered background credentials on the server (0021); the current app attempts to re-register after an in-app recovery. Failed registration is surfaced, but delivery and credential lifecycle require end-to-end device testing.

Standalone mobile now includes RLS-scoped search, a weekly recap separated by currency, and JSON/CSV export of selected visible fields. Search is limited to 50 matches. The JSON/CSV exports exclude document files, are bounded (10,000 rows per table and 8 MiB total) and are not a transactional snapshot; CSV text is protected against spreadsheet formulas. Android saving uses the system document picker and has only been compiled, not verified on a physical device. Complete M29 parity and end-to-end testing still require further work.

A standalone Today overview (due/overdue counts) and quick-add forms for task, event, shopping item, expense and weekly chore are now implemented. These use the user's existing Supabase transports. They and the Android picker have automated unit/compile coverage only; no real-device or two-account tests have been performed. Full theme and feature parity remain open.


The standalone ZIP export bundles visible document files and JSON metadata, with
limits of 200 files, 12 MiB file content, and 4 MiB JSON; failures downloading
any file fail the export. It is not a transactional snapshot or an unlimited
backup. Android SAF transfer uses bounded chunks; physical-device testing remains.
The mobile web build has an install manifest and a static-shell-only service
worker; Supabase/API data are not cached and functionality requires connectivity.
Actual browser installation, offline recovery, update behavior and multi-user
privacy on shared devices have not been verified.

Export projections now include task assignment/recurrence, chore rotation,
notification preferences and document links in addition to the previously
selected data; local database checks validate the selected columns and grants.
They still do not include all account/household metadata or provide restore.
The current server recurrence function truncates due times to UTC midnight and
interprets weekday selections in UTC; this must be fixed with an explicit
timezone design and tested before claiming recurrence parity. Financial
recurrence is only a flag and does not generate future records.
