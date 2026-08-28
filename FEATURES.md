# FEATURES.md

وضعیت فعلی: **Milestone 10 Search completed**

## Phase 1 (MVP) Feature Matrix

| Feature                   | Scope خلاصه                                        | وضعیت             |
| ------------------------- | -------------------------------------------------- | ----------------- |
| Foundation UI/RTL/Persian | shell موبایل، RTL، typography، states              | ✅ Completed (M1) |
| Theme                     | light/dark/system + persistence                    | ✅ Completed (M1) |
| PWA Base                  | manifest + installability + offline fallback       | ✅ Completed (M1) |
| Auth                      | signup/login/logout/reset + protected routes       | ✅ Completed (M2) |
| Profile                   | ویرایش پروفایل، timezone، locale                   | ✅ Completed (M2) |
| Household                 | create/join/leave + owner/member roles             | ✅ Completed (M3) |
| Invitations               | invite link/code + expiration + cancel             | ✅ Completed (M3) |
| RLS Core                  | private/shared isolation + membership checks       | ✅ Completed (M3) |
| Tasks                     | CRUD + status + priority + visibility + assignment | Planned (M4)      |
| Recurrence                | daily/weekly/custom with rrule model               | Planned (M4)      |
| Today Dashboard           | اولویت‌بندی کارهای امروز و overdue                 | ✅ Completed (M5) |
| Calendar                  | month/week/agenda + tasks/events aggregation       | ✅ Completed (M5) |
| Reminder Foundation       | data model + schedule calculations                 | ✅ Completed (M6) |
| Notification Prefs        | in-app/web push settings                           | ✅ Completed (M6) |
| Chores                    | recurring chores + assignment/rotation پایه        | ✅ Completed (M7) |
| Shopping                  | shared list + quick check/uncheck                  | ✅ Completed (M8) |
| Realtime                  | scoped sync for shopping + shared task updates     | Partial (M8)      |
| Finance Lite              | bills + one-off expenses; PRIVATE/SHARED; `/finance` + Today + Home + FAB | ✅ Completed (M9) |
| Search                    | cross-domain search with permission filters        | Planned (M10)     |
| Settings                  | profile/household/privacy/theme/pwa help           | Planned (M10)     |
| Offline Improvements      | app shell cache + offline page + retry UX          | Planned (M10)     |
| Test Hardening            | unit/integration/e2e critical flows                | Planned (M11)     |
| Security Review           | RLS verification + auth audit                      | Planned (M11)     |

## خارج از MVP (Phase 2+)

- Documents/attachments کامل
- Health module کامل
- Vehicles module کامل
- Meal planning کامل
- Goals/Savings کامل
- Advanced routines/templates
- AI/Voice

## خارج از Milestone 9 (Finance Lite)

M9 شامل این‌ها **نیست**:

- Income
- Debt
- Installments
- Subscription product
- Budget
- Savings
- Goals
- Recurring finance engine
- Finance reminders
- AI
- Voice
- Split ledger
- Reports/charts

## تعریف کامل شدن فیچر

هر آیتم تنها وقتی Complete می‌شود که:

- schema + policy + server logic + UI + validation + states + tests آماده باشد.

## نمونه سناریوهای پذیرش MVP

1. دو کاربر ثبت‌نام می‌کنند.
2. Household مشترک تشکیل می‌دهند.
3. کاربر A تسک shared می‌سازد؛؛ کاربر B می‌بیند.
4. کاربر A تسک private می‌سازد؛ کاربر B نمی‌بیند.
5. shopping item در لحظه sync می‌شود.
6. bill ثبت می‌شود و قبض‌های معوق/سررسید امروز در صفحهٔ Today دیده می‌شوند.
