# TODO.md

## Current Phase

- Phase 1 (MVP)
- Current milestone: **Milestone 11 (Hardening & Release Readiness)** 🚧

## Planning Deliverables

- [x] Repository audit
- [x] PROJECT_PLAN.md / ARCHITECTURE.md / DATABASE.md / FEATURES.md / SECURITY.md / PWA.md
- [x] README.md (setup, scripts, deploy)
- [x] CI workflow (`.github/workflows/ci.yml`)

## Milestone 1 - Foundation ✅

- [x] Persian/RTL app shell
- [x] mobile-first navigation + FAB
- [x] theme system (light/dark/system) + settings entry point
- [x] design primitives
- [x] PWA manifest/icons
- [x] service worker baseline (shell-only cache, no private page caching)
- [x] offline fallback page
- [x] route skeletons
- [x] loading/empty/error primitive states

## Milestone 2 - Auth & Profile ✅

- [x] Supabase client wiring (browser/server/middleware)
- [x] email signup/login/logout/reset
- [x] protected routes middleware (degrades gracefully if Supabase is unreachable)
- [x] profile CRUD

## Milestone 3 - Household & Invitations & RLS Core ✅

- [x] household create/join/leave (security definer RPCs)
- [x] invitation issue/accept/cancel/expire
- [x] member roles
- [x] baseline RLS policies + table grants for `authenticated`
- [x] policy verification scenarios

## Milestone 4 - Tasks & Recurrence ✅

- [x] task CRUD + visibility
- [x] assignment model
- [x] recurrence model/engine
- [x] reminder model for tasks

## Milestone 5 - Today + Calendar ✅

- [x] today aggregation
- [x] Jalali display formatting
- [x] calendar month/week/agenda baseline

## Milestone 6 - Reminders Foundation ✅

- [x] reminder scheduling model
- [x] notification preferences
- [x] push/web capability detection + permission UX + fallback

## Milestone 7 - Chores ✅

- [x] chore CRUD (create/edit/archive/pause)
- [x] recurring schedule (`calculate_next_chore_due` in SQL)
- [x] rotation baseline (`chore_rotation_steps` + `complete_chore` RPC)
- [x] completion history (`chore_completions`)
- [x] unit tests for rotation/state (`src/features/chores/rotation.test.ts`)

## Milestone 8 - Shopping + Realtime ✅

- [x] shopping lists/items CRUD
- [x] realtime sync scoped to `shopping_items` channel
- [x] optimistic toggle purchased (with rollback on failure)
- [x] first-list creation flow when a household has no list yet

## Milestone 9 - Finance Lite ✅

- [x] bills/expense/income records
- [x] due/overdue states synced by DB trigger
- [x] today dashboard integration (upcoming bills)
- [x] finance summary + unit tests

## Milestone 10 - Search + Settings + Offline ✅

- [x] global search baseline (`search_workspace` RPC, RLS-aware)
- [x] settings page (theme, reminder prefs, PWA help, household link)
- [x] offline UX (shell caching + offline page, private pages excluded)

## Milestone 11 - Hardening 🚧

- [x] unit tests (recurrence/date/permissions/finance/chores)
- [x] CI (typecheck + lint + test + build)
- [x] RLS verification scenarios executed directly against Postgres
- [x] smoke script for end-to-end verification on a live environment
- [x] integration suite wired into CI (Postgres service + auth shim + RLS assertions)
- [x] reminder dispatch endpoint (cron or signed-in user) + quiet-hours deferral + tests
- [ ] integration test suite against a disposable Supabase branch (currently: plain Postgres)
- [ ] e2e critical journeys (browser) — blocked: no browser in this environment
- [ ] performance review (Lighthouse/bundle budget)
- [ ] production deployment runbook + backups/restore drill

## Quality Gate Checklist (Run each milestone)

- [x] formatter
- [x] lint
- [x] typecheck
- [x] tests
- [x] build
