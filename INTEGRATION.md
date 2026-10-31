# Integrating the paper redesign

The paper redesign lives on `arena/01a05828-khoonemoon` (tip `0543138`). It diverged from `main`: it is not a newer superset of main. Do not deploy it against the current database as a workaround.

The integration starts from main (`8b72c84`) to retain the later finance, reminders, summaries and export work. Port UI changes incrementally rather than replacing server code wholesale. The shared paper tokens, button, card and input styles are the first slice; retain React 19 ref forwarding and generated input IDs. Screen layouts, navigation, dialogs and accessibility still require integration and browser testing.

## Shopping schema mismatch

Inspection of the live `khoonemoon` database on 2026-10-30 shows `shopping_lists.archived_at` (not `is_active`). Its `shopping_items` columns include `added_by`, `purchased`, `purchased_by`, and `purchased_at`, not the redesigned branch's `created_by`, `is_checked`, `checked_by`, and `checked_at`. The main branch's shopping API uses the live schema. Adding a single `is_active` column would therefore not fix the redesigned branch and could produce conflicting data models. Preserve current data and RLS; do not apply the other branch's shopping migration blindly.

Documents routes, UI and an adapted migration have been ported locally; the migration is not yet applied to production. The local RLS suite covers private/shared document and storage isolation and finance attachment access. Before release: port remaining screen layouts, verify document upload/download and authenticated journeys against a safe environment, and validate mobile UI. Review branch-specific settings and make the eventual Netlify production branch point to the integrated version only after verification.

## Direct mobile schedule transport

Migrations `0013_mobile_atomic_create.sql` and `0014_mobile_atomic_update.sql`
were applied to the connected Supabase project on 2026-10-31 after local and CI
Postgres/RLS checks. Both expose SECURITY INVOKER functions only to authenticated
users. Metadata confirms anon cannot execute them. Real two-account and Android
tests are still outstanding. The standalone mobile prototype is not yet packaged
into the Android APK. Its task recurrence fields preserve the existing model;
automatic creation of the next task on completion uses migration `0015_recurring_task_completion.sql` applied to Supabase. It is tested locally and in CI, but not yet with real accounts or on Android. The mobile calendar has month, week and agenda views, pending real-device testing.

### Mobile shopping and finance

The independent mobile UI includes shopping and financial record flows using the current user's JWT and RLS. The finance realtime publication migration `0016_finance_realtime.sql` has been applied to project `isfzuxrkzeeeggvfcoah`; shopping lists, shopping items, and financial records are in `supabase_realtime`. A foreground and periodic refresh covers missed events, including deletes. Realtime delivery and the interface have not yet been exercised end-to-end with two real accounts or on Android. Reports and settlement are restricted to the chosen currency; settlement is an estimate for current household members, not a recorded payment. Financial recurrence is only a flag and does not create future records. The independent mobile UI is not yet packaged in the Android wrapper. The user-facing Android build and real-device testing remain in the integration phase.

### Document screen and database deployment

The mobile document screen includes category filtering, user-scoped upload, short-lived signed URLs, metadata editing, deletion and entity links. Production project `isfzuxrkzeeeggvfcoah` has the documents and document_category migrations applied; tables have RLS enabled and the private documents bucket has scoped policies. Database RLS assertions and client mock tests pass, but actual Storage upload/download, Android file chooser, sharing and two-user isolation have not been tested on real devices. Deletion is two-step: a storage deletion can succeed before metadata deletion fails, in which case the UI explicitly reports the partial failure. Export still does not include document files. Background Android reminder notifications and complete final integration remain open.
