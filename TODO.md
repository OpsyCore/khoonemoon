# TODO.md

## Current Phase

- Phase 1 (MVP) ✅ Completed (M1–M11)
- Phase 2: **Milestone 12 (Documents & Attachments)** ✅ Completed
- Next milestone: not defined (Health / Vehicles / Meal / Goals / Advanced Finance remain out of scope until specified)
- Live schema on **khoonemoon** (`isfzuxrkzeeeggvfcoah`): `0010` + `repair_m9_finance_lite` + `0011` APPLIED; finance/documents RLS + private `documents` bucket
- Two-user interactive QA = NOT EXECUTED

## Planning Deliverables

- [x] Repository audit
- [x] PROJECT_PLAN.md
- [x] ARCHITECTURE.md
- [x] DATABASE.md
- [x] FEATURES.md
- [x] SECURITY.md
- [x] PWA.md
- [x] Initial risk register
- [x] Milestone 1 detailed definition

## Milestone 1 - Foundation ✅

- [x] Persian/RTL app shell
- [x] mobile-first navigation + FAB
- [x] theme system (light/dark/system)
- [x] design primitives
- [x] PWA manifest/icons
- [x] service worker baseline
- [x] offline fallback page
- [x] route skeletons
- [x] loading/empty/error primitive states
- [x] update docs after implementation

## Milestone 2 - Auth & Profile ✅

- [x] Supabase client wiring
- [x] email signup/login/logout/reset
- [x] protected routes middleware
- [x] profile CRUD

## Milestone 3 - Household & Invitations & RLS Core ✅

- [x] household create/join/leave
- [x] invitation issue/accept/cancel/expire
- [x] member roles
- [x] baseline RLS policies
- [x] policy verification scenarios

## Milestone 4 - Tasks & Recurrence ✅

- [x] task CRUD + visibility
- [x] assignment model
- [x] recurrence model/engine (rrule-ready service)
- [x] reminder model for tasks (data foundation آماده در task_recurrences)

## Milestone 5 - Today + Calendar ✅

- [x] today aggregation
- [x] Jalali display formatting
- [x] calendar month/week/agenda baseline

## Milestone 6 - Reminders Foundation ✅

- [x] reminder scheduling model
- [x] notification preferences
- [x] push/web capability detection + permission UX + fallback

## Milestone 7 - Chores ✅

- [x] chore CRUD
- [x] recurring chores
- [x] rotation baseline

## Milestone 8 - Shopping + Realtime ✅

- [x] shopping lists/items CRUD
- [x] household-scoped lists with RLS
- [x] check/uncheck purchased items

## Milestone 9 - Finance Lite ✅

- [x] bills + one-off expenses (`public.finance_records`)
- [x] PRIVATE | HOUSEHOLD_SHARED
- [x] derived due/overdue (no stored bill status)
- [x] RLS + RPCs (`create_finance_record`, `update_finance_record`, `set_finance_record_paid`)
- [x] Today: unpaid overdue + due-today bills + pay + link to `/finance`
- [x] `/finance` page (CRUD, pay/unpay, filters, totals)
- [x] Home finance summary + links to `/finance`
- [x] FAB «هزینه / قبض» → `/finance#quick-add-finance`

Not in M9: income, debt, installments, subscriptions, budget, savings, goals, recurring finance, finance reminders, AI, voice, split ledger, reports/charts.

## Milestone 10 - Search + Settings + Offline Improvements ✅

- [x] global household-scoped search (`/search`, `GET /api/search`)
- [x] settings page (account, theme, connection, reminders, PWA/offline help)
- [x] resilient offline UX (status, retry, SW fallback; no offline mutation queue)

## Milestone 11 - Hardening ✅

- [x] unit tests (recurrence/date/permissions)
- [x] integration tests (authorization)
- [x] e2e critical journeys (Vitest against domain/API contracts; live two-user browser script in `E2E.md`)
- [x] security review (`SECURITY.md` §12, `SECURITY_TESTS.md`)
- [x] performance review (`PERFORMANCE.md`)
- [x] deployment readiness docs (`DEPLOYMENT.md`)

Not in M11: Playwright runner, live Supabase apply of `0010`, new product features, shopping/finance/search scope changes, M12.

## Milestone 12 - Documents & Attachments ✅

- [x] document metadata (`title`, optional description, mime/type, size, storage path, uploader, visibility, household)
- [x] PRIVATE | HOUSEHOLD_SHARED (PRIVATE ⇒ `household_id IS NULL`; SHARED ⇒ household required)
- [x] optional attach-to-existing-entity via `document_attachments` (no ALTER on M8/M9/tasks/events/chores)
- [x] private Supabase Storage bucket `documents`; no public object URLs
- [x] signed URL for view/download after metadata access check
- [x] RLS + authenticated client (no service-role in browser/runtime pages)
- [x] API: list / create+upload / get / update metadata / delete / signed URL / attachments
- [x] UI `/documents`: list, upload, view/download, delete, loading/empty/error/retry; RTL; no 6th bottom-nav tab
- [x] tests: authz, household isolation, CRUD, validation, unauthorized/invalid id

Not in M12: Health, Vehicles, Meal, Goals, Advanced Finance/Reports, OCR, AI, extra-household sharing, public file URLs, offline upload queue, UI redesign, Auth/Supabase architecture change, Playwright, expanding reminder target types.

## Quality Gate Checklist (Run each milestone)

- [x] formatter
- [x] lint
- [x] typecheck
- [x] tests
- [x] build
