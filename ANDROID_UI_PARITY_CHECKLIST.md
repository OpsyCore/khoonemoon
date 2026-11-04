# Android ↔ web UI parity — audit and open checklist

Baseline: `main` at `fd746ecc0c46d25d0e7ef79576e0efffa49300a4`. Android is a local-asset WebView hosting the independent Vite React entry `mobile/src/main.tsx`, not the Next.js server. Both use the same Supabase project; neither static shell represents an authenticated functional test.

This checklist records code-level observations, **not visual or functional sign-off**. Layouts that share a React component can still differ because their outer shells, base CSS, route integration, viewport and platform behavior differ. Every line needs comparison at phone size in both themes, including loaded, empty, error and relevant dialog states, and real navigation/data tests.

## Screens and flows

- [ ] Today: shared `Today` component; Next route wrapper and mobile task management/quick-add integration differ. Compare action routes, full page and editing states.
- [ ] Calendar: separate `CalendarBoard` web and `CalendarEvents` mobile. Compare month/week/agenda, create/edit, recurrence, event/task/chore projections and accessibility.
- [ ] Home: shared `HomeDashboard`; web wrapper and mobile household handling differ. Compare no-house/owner/member, invite, manage and transfer panel.
- [ ] Shopping: shared `Shopping`, but web `/lists` adds tabs and server-loaded chores/finance while mobile uses a direct destination and household guard. Compare switching lists, edits, realtime and empty/error states.
- [ ] Finance: shared `Finance`; web has additional legacy ledger route, native link/state handling differs. Compare dashboard, ledger, charts, bills and forms.
- [ ] Reminders: shared `Reminders`; permission/notification controls differ by browser and Android bridge. Compare inbox, create/edit and reminders delivery settings.
- [ ] Search: shared `Search`, platform navigation adapters differ. Compare query, filters, results, history and direct links.
- [ ] Profile: separate web `ProfileForm`/page and mobile `Profile` implementation. Compare layout, editing, loading, error and save states.
- [ ] Settings: shared `SettingsDashboard`; web install/browser-push integrations and Android notification bridge differ. Compare theme, permission, account, export and recovery.
- [ ] Documents: shared `Documents`; picker and save/share depend on Android bridge. Compare upload/download, visibility, details, filtering and errors with safe files/accounts.
- [ ] Household chores: shared `ChoresDashboard` but platform adapters and management flows differ. Compare list, history, completion, editing and failure states.
- [ ] New task and new event: shared form components; return/navigation and native browser semantics differ. Compare fields, dates, recurrence, reminders, validation and unsaved changes.
- [ ] Authentication: separate mobile and Next signup/login surfaces; shared recovery view. Compare login/signup/reset, error messages, email links and Android deep link.
- [ ] All existing edit/detail dialogs, quick-add, export/backup, transfer panel, offline and permission prompts, not only top-level routes.

## Shared shell and Android quality

- [ ] Compare five-tab navigation, hamburger menu, active state, focus, icon sizes and text; preserve five fixed destinations.
- [ ] Compare typography, shared controls, cards, backgrounds, surface contrast and spacing; embedded screen-specific CSS still includes independent colors and rules.
- [ ] Verify `light`, `dark` and system mode persistence; web uses `.dark`, mobile uses `data-theme`. Device status/navigation bars need independent verification.
- [ ] Verify RTL, narrow widths, 44–48dp touch targets, horizontal overflow, scroll, keyboard, dialogs and safe-area insets.
- [ ] Verify Android hardware back behavior for page navigation, dialogs and unsaved forms; WebView back currently checks WebView history, while internal pages use React state.
- [ ] Compare loading, empty, success, error, offline and partially loaded states for each route.
- [ ] Confirm RLS, actual two-account isolation, CRUD, Storage, realtime, recovery deep links, notifications and real authentication without exposing private data.

## Verification gate

- [ ] Capture comparable real web and Android screenshots for every screen and relevant state, light and dark.
- [ ] Verify actual Android interaction, not just browser emulation or CSS assertions.
- [ ] Run TypeScript, ESLint, tests, web/mobile production builds and relevant HTTP E2E; compile Android.
- [ ] Only after implementation and visual/functional verification passes, build and deliver the requested APK.

A shared token extraction does not by itself satisfy the screen, device, or visual parity criteria.
