# SECURITY.md

## 1) Security Principles

- Zero trust for client input
- Privacy-by-default
- DB-enforced authorization (RLS first)
- Least privilege access
- No secret leakage to client

## 2) Data Classification

- **Private**: health notes, personal tasks, personal finance, private docs
- **Household Shared**: shared tasks, shopping lists, shared bills/events
- **System/Internal**: audit metadata, job status, reminder queues

## 3) Auth Strategy

- Supabase Auth (email/password, reset password)
- Persistent session via secure cookies
- middleware checks for protected routes
- future-ready for Google/Apple/phone

## 4) Authorization Strategy

- Every record has owner context; shared records also have household context.
- UI filtering is non-security; real enforcement in RLS/policies.
- Server mutations always verify:
  1. authenticated user
  2. household membership (if household-scoped)
  3. visibility constraints

## 4.1) Table Grants (M11)

RLS فقط ردیف‌ها را محدود می‌کند؛ دسترسی پایه جدول با `grant` کنترل می‌شود. چون جداول با
SQL خام ساخته می‌شوند، Supabase هیچ grant پیش‌فرضی اضافه نمی‌کند و هر مهاجرت خودش grantها
را تنظیم می‌کند:

| جدول                                      | authenticated                              |
| ----------------------------------------- | ------------------------------------------ |
| profiles                                  | select, insert, update                     |
| households                                | select, insert, update                     |
| household_members / household_invitations | select فقط (mutation با RPC)               |
| tasks / task_recurrences                  | select, insert, update, delete             |
| task_assignees                            | select, insert, delete                     |
| events                                    | select, insert, update, delete             |
| reminders                                 | select, insert, update, delete             |
| notification_preferences                  | select, insert, update                     |
| chores                                    | select, insert, update, delete             |
| chore_rotation_steps                      | select, insert, delete                     |
| chore_completions                         | select فقط (نوشتن با RPC `complete_chore`) |
| shopping_lists / shopping_items           | select, insert, update, delete             |
| financial_records                         | select, insert, update, delete             |

`anon` هیچ دسترسی‌ای به جداول دامنه ندارد. schema `legacy_backup` (آرشیو نسخه قبلی)
برای `anon` و `authenticated` صریحاً `revoke` شده است.

## 5) RLS Core Rules (Implemented in M2/M4)

1. profiles: read/insert/update own profile only ✅
2. households: read only if active member of household ✅
3. households update: owner-only ✅
4. household_members:
   - select: only members of same household ✅
   - direct insert/update/delete: denied (no policies) ✅
5. household_invitations:
   - select: only household members ✅
   - direct insert/update/delete: denied (RPC-only mutation) ✅
6. tasks:
   - PRIVATE task: only owner ✅
   - HOUSEHOLD_SHARED task: active household members ✅
   - task_assignees/task_recurrences inherit task access via helper policies ✅
7. events/calendar (M5 implemented):
   - PRIVATE event: only owner ✅
   - HOUSEHOLD_SHARED event: active household members ✅
8. reminders/preferences (M6 implemented):
   - reminders: user can read/update/delete only own reminders ✅
   - reminder insert requires authenticated owner + target access validation ✅
   - notification_preferences: own row only ✅
9. chores (M7):
   - `chores`: فقط اعضای خانه
   - `chore_rotation_steps`: دسترسی از طریق `current_user_can_access_chore`
   - `chore_completions`: فقط select؛ نوشتن صرفاً با `complete_chore` (بررسی عضویت + auth.uid)
10. shopping (M8):

- `shopping_lists`: فقط اعضای خانه
- `shopping_items`: از طریق `current_user_can_access_shopping_list` و `added_by = auth.uid()`

11. finance (M9):

- PRIVATE: فقط owner
- HOUSEHOLD_SHARED: فقط اعضای خانه + الزام `household_id`

12. search (M10):

- `search_workspace` به‌صورت security invoker اجرا می‌شود تا RLS هر جدول اعمال شود

13. controlled mutations via `security definer` RPC:

- create_household
- create_household_invitation
- join_household_with_invitation
- cancel_household_invitation
- leave_current_household
- complete_chore

## 6) Storage Security (Supabase Storage)

- No public buckets for private docs.
- Object path convention: `user/{userId}/...` for private and `household/{householdId}/...` for shared.
- Access via signed URLs with policy checks.
- Validate mime type + size before upload.

## 7) Input Validation

- Zod schemas on all external input paths:
  - forms
  - route handlers
  - server actions
  - AI structured payloads (future)

## 8) Sensitive Operations

- account deletion: re-auth + confirmation step
- household owner leave: transfer ownership flow required
- visibility change private<->shared: explicit checks and audit trail

## 9) Logging & Observability

- Never log: passwords, tokens, note content, health data, secrets.
- Log only metadata (event type, actor id, entity id, status code).
- Prepare hooks for Sentry-like provider in production.

## 10) Threat/Risk Focus Areas

- IDOR via route handlers
- weak invitation links/reuse attacks
- RLS policy gaps in join conditions
- replay of expired invite
- accidental storage object exposure

## 10.1) Robustness

- `getSupabaseEnv()` در صورت نبود پیکربندی خطای فارسی می‌دهد و middleware در نبود
  اعتبارنامه‌ها کرش نمی‌کند (درخواست عبور می‌کند تا صفحه قابل‌خواندن نمایش داده شود).
- اتصال مستقیم Postgres (`DATABASE_URL`) به‌صورت lazy ساخته می‌شود تا نبود آن باعث
  خطای build/runtime نشود.
- service worker هیچ درخواست `/api/*`، `/auth/*` یا صفحه احراز هویت‌شده‌ای را کش نمی‌کند.

## 11) Verification Plan

- policy verification SQL scenarios (allow/deny)
- integration tests for household boundaries
- e2e test for private/shared visibility isolation
- Milestone 3 security checks documented in `SECURITY_TESTS.md`
- automated unit checks in `src/features/households/security.test.ts`
- Milestone 4 task security/recurrence/completion tests in:
  - `src/features/tasks/security.test.ts`
  - `src/features/tasks/recurrence.test.ts`
- Milestone 6 reminder/timezone/snooze tests in:
  - `src/features/reminders/calculations.test.ts`
