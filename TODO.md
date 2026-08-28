# TODO.md

## Current Phase

- Phase 1 (MVP)
- Current milestone: **Milestone 10 (Search + Settings + Offline UX)** ✅ Completed

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

## Milestone 10 - Search + Settings + Offline Improvements

- [x] global household-scoped search (`/search`, `GET /api/search`)
- [x] settings page (account, theme, connection, reminders, PWA/offline help)
- [x] resilient offline UX (status, retry, SW fallback; no offline mutation queue)

## Milestone 11 - Hardening

- [ ] unit tests (recurrence/date/permissions)
- [ ] integration tests (authorization)
- [ ] e2e critical journeys
- [ ] security review
- [ ] performance review
- [ ] deployment readiness docs

## Quality Gate Checklist (Run each milestone)

- [x] formatter
- [x] lint
- [x] typecheck
- [x] tests
- [x] build
