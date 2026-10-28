# DATABASE.md

## 1) اصول دیتابیس

- PostgreSQL with UUID primary keys
- UTC timestamps (`timestamptz`)
- visibility model: `PRIVATE` | `HOUSEHOLD_SHARED`
- soft-delete where needed (`archived_at`, `deleted_at`)
- RLS required on all user data tables

## 2) Enumهای اصلی

- `visibility_type`: PRIVATE | HOUSEHOLD_SHARED
- `task_status`: PENDING | IN_PROGRESS | COMPLETED | SKIPPED | ARCHIVED
- `task_priority`: LOW | NORMAL | HIGH | CRITICAL
- `member_role`: OWNER | MEMBER
- `invitation_status`: PENDING | ACCEPTED | CANCELED | EXPIRED
- `bill_status`: UPCOMING | DUE | PAID | OVERDUE

## 3) موجودیت‌های هسته

### profiles

- `id` (uuid, pk, references auth user id)
- `email` (unique)
- `full_name`
- `avatar_path` (nullable)
- `timezone` (default `Asia/Tehran`)
- `locale` (default `fa-IR`)
- `created_at`, `updated_at`

### households

- `id` (uuid)
- `name`
- `created_by` (fk auth.users.id)
- `created_at`, `updated_at`

### household_members

- `id` (uuid)
- `household_id` (fk households.id)
- `user_id` (fk auth.users.id)
- `role` (member_role)
- `joined_at`
- `left_at` (nullable)
- unique active membership per `(household_id, user_id)`
- unique active household per `user_id` (MVP: هر کاربر فقط یک household فعال)

### household_invitations

- `id` (uuid)
- `household_id` (fk)
- `invited_by` (fk auth.users.id)
- `invite_code_hash` (unique)
- `expires_at`
- `status` (invitation_status)
- `accepted_by` (nullable fk auth.users.id)
- `accepted_at`, `canceled_at`, `created_at`

### Milestone 3 Security Mutation Pattern

- mutationهای حساس (`join`, `leave`, `invite create/cancel`) با RPCهای `security definer` انجام می‌شوند.
- روی `household_members` و `household_invitations` policy مستقیم insert/update/delete نداریم.
- این طراحی جلوی mutation مستقیم غیرمجاز را می‌گیرد و تمام قوانین کسب‌وکار در یک لایه کنترل‌شده enforce می‌شود.

## 4) Task Domain

### tasks

- `id` (uuid)
- `household_id` (nullable fk households.id)
- `creator_id` (fk auth.users.id)
- `owner_id` (fk auth.users.id)
- `title`
- `description` (nullable)
- `visibility` (`task_visibility`)
- `status` (`task_status`)
- `priority` (`task_priority`)
- `due_at` (nullable timestamptz)
- `completed_at` (nullable)
- `archived_at` (nullable)
- `created_at`, `updated_at`

### task_assignees

- `id` (uuid)
- `task_id` (fk tasks.id)
- `assignee_id` (fk auth.users.id)
- unique(`task_id`,`assignee_id`)

### task_recurrences

- `id` (uuid)
- `task_id` (fk tasks.id unique)
- `frequency` (`task_recurrence_frequency`)
- `interval_days` (nullable int)
- `weekdays` (nullable int[])
- `next_occurrence_at` (nullable timestamptz)
- `created_at`, `updated_at`

### reminders

- `id` (uuid)
- `target_type` (TASK | EVENT)
- `target_id` (uuid)
- `user_id` (fk auth.users.id)
- `household_id` (nullable fk households.id)
- `remind_at` (timestamptz)
- `status` (PENDING | SNOOZED | SENT | CANCELED)
- `snoozed_until` (nullable timestamptz)
- `snooze_count` (int)
- `delivered_at` (nullable timestamptz)
- `created_at`, `updated_at`

## 5) Calendar Domain

### events

- `id` (uuid)
- `household_id` (nullable fk households.id)
- `creator_id` (fk auth.users.id)
- `owner_id` (fk auth.users.id)
- `title`, `description`
- `start_at`, `end_at` (timestamptz)
- `all_day` (bool)
- `location` (nullable)
- `visibility` (`event_visibility`)
- `created_at`, `updated_at`

> Note: `event_participants` در Milestone 5 پیاده‌سازی نشده و در فازهای بعدی اضافه می‌شود.

## 6) Chores Domain (Milestone 7 — پیاده‌سازی‌شده)

### chores

- `id` (uuid)
- `household_id` (fk households.id, not null)
- `title`, `description`
- `created_by` (fk auth.users.id)
- `rotation_mode` (`chore_rotation_mode`: FIXED | ROTATING)
- `current_rotation_index` (int, پیش‌فرض 0)
- `frequency` (`task_recurrence_frequency`) + `interval_days` + `weekdays`
- `next_due_at` (timestamptz)
- `is_active`, `archived_at`
- `created_at`, `updated_at`

### chore_rotation_steps

- `id`, `chore_id`, `position` (int), `assignee_id` (fk auth.users.id)
- unique(`chore_id`, `position`)

### chore_completions

- `id`, `chore_id`, `completed_by`, `completed_at`, `due_at`, `note`
- فقط از طریق RPC `complete_chore(p_chore_id)` نوشته می‌شود (بدون policy برای insert مستقیم)

### توابع مرتبط

- `calculate_next_chore_due(from, frequency, interval_days, weekdays)` → timestamptz
- `complete_chore(chore_id)` → (completion_id, next_due_at, next_assignee_id)
  - تکمیل را ثبت می‌کند، ایندکس چرخش را جلو می‌برد (mod تعداد مراحل) و `next_due_at` را بازمحاسبه می‌کند
- `current_user_can_access_chore(chore_id)` — گارد دسترسی برای مراحل/تاریخچه

## 7) Finance Domain (Milestone 9 — پیاده‌سازی‌شده)

### financial_records

- `id` (uuid)
- `household_id` (nullable — برای PRIVATE باید null باشد)
- `owner_id`, `created_by` (fk auth.users.id)
- `visibility` (`visibility_type`: PRIVATE | HOUSEHOLD_SHARED)
- `record_type` (`financial_record_type`: EXPENSE | INCOME | BILL | SUBSCRIPTION | INSTALLMENT | DEBT)
- `title`, `amount` (numeric(14,2)), `currency` (default IRR), `category`, `note`
- `occurred_at`, `due_at`
- `bill_status` (`bill_status`: UPCOMING | DUE | PAID | OVERDUE) — با trigger همگام می‌شود
- `is_recurring`, `recurrence_rule`
- `paid_by`, `paid_at`
- `archived_at`, `created_at`, `updated_at`

قواعد:

- `PRIVATE` ⇔ `household_id is null` و `owner_id = created_by`
- `HOUSEHOLD_SHARED` ⇒ `household_id` الزامی
- `bill_status` فقط برای BILL/SUBSCRIPTION/INSTALLMENT معنا دارد و توسط
  `sync_financial_record_due_status()` محاسبه می‌شود (OVERDUE / DUE تا ۳ روز / UPCOMING / PAID)

## 8) Shopping Domain (Milestone 8 — پیاده‌سازی‌شده)

### shopping_lists

- `id`, `household_id` (not null), `name`, `created_by`, `archived_at`, timestamps

### shopping_items

- `id`, `list_id`, `name`, `quantity`, `unit`, `category`, `note`
- `added_by`, `purchased`, `purchased_by`, `purchased_at`, `position`
- جدول‌های `shopping_lists` و `shopping_items` به publication `supabase_realtime` اضافه شده‌اند

## 9) Shared Support Tables

### inbox_items

- quick capture text, parse_status, parsed_payload(jsonb optional)

### notification_preferences

- `user_id` unique (fk auth.users.id)
- `in_app_enabled`
- `web_push_enabled`
- `quiet_hours_enabled`
- `quiet_hours_start`, `quiet_hours_end`
- `created_at`, `updated_at`

### push_subscriptions

- endpoint, keys, user_id, device info, revoked_at

## 10) Search (Milestone 10)

- افزونه `pg_trgm` + ایندکس GIN روی `title`/`name` جداول tasks, events, shopping_items,
  financial_records, chores
- تابع `search_workspace(p_query, p_limit)` به‌صورت **security invoker** اجرا می‌شود؛
  بنابراین RLS هر جدول روی ردیف‌ها اعمال می‌شود و کاربر هرگز داده غیرمجاز نمی‌بیند.
- خروجی: `kind`, `entity_id`, `title`, `subtitle`, `happened_at`, `status`

## 11) ایندکس‌های کلیدی

- `tasks(owner_id, status, due_at)`
- `tasks(household_id, visibility, due_at)`
- `task_assignees(assignee_id)`
- `events(household_id, start_at)`
- `shopping_items(list_id, purchased)`
- `financial_records(household_id, due_at, bill_status)`
- `household_invitations(household_id, status, expires_at)`

## 12) RLS Policy Model (خلاصه)

- کاربر فقط پروفایل خودش را می‌خواند/ویرایش می‌کند.
- household data فقط برای اعضای همان household.
- رکورد PRIVATE: فقط owner_id
- رکورد HOUSEHOLD_SHARED: اعضای household مرتبط
- invitation create/cancel: فقط اعضای مجاز household (role-aware)
- join by invite: فقط invite معتبر + منقضی‌نشده + استفاده‌نشده

## 13) قواعد مهم دیتایی

- PRIVATE record نباید household_id غیرمعتبر داشته باشد.
- برای HOUSEHOLD_SHARED وجود household_id اجباری است.
- owner_id همیشه set باشد.
- delete سخت برای داده اصلی ممنوع؛ soft-delete ترجیحی.

## 14) Recurrence Strategy

- recurrence در `task_recurrences` با `frequency + interval_days + weekdays` ذخیره می‌شود.
- occurrenceها به صورت lazy/generated در query window محاسبه می‌شوند.
- از تولید بی‌نهایت row جلوگیری می‌شود.
- `next_occurrence_at` برای پردازش reminder queue نگهداری می‌شود.
- reminder records (`reminders`) منبع اصلی برنامه‌ریزی اعلان هستند و قابل استفاده مجدد برای کلاینت‌های Android/iOS آینده می‌باشند.

## 15) دسترسی‌ها (Grants)

Supabase هیچ grant پیش‌فرضی برای جداول ساخته‌شده با SQL خام اضافه نمی‌کند؛ بنابراین هر
مهاجرت در انتهای خود `grant` لازم برای نقش `authenticated` را دارد:

- `select` برای همه جداول دامنه
- `insert/update/delete` فقط جایی که mutation مستقیم مجاز است
- `household_members` و `household_invitations`: فقط `select` (تغییر فقط با RPC)
- `chore_completions`: فقط `select` (نوشتن فقط با RPC)
- `execute` روی RPCها (`create_household`, `join_household_with_invitation`,
  `complete_chore`, `search_workspace`, …)

بدون این grantها همه کوئری‌ها با خطای `permission denied` شکست می‌خورند حتی اگر RLS درست باشد.

## 16) Migration Strategy

- `drizzle/*.sql` منبع حقیقت schema + RLS + RPC + grants است و به ترتیب شماره اعمال می‌شود.
- migrationها idempotent و non-destructive هستند.
- `src/db/schema.ts` فقط مرجع تایپ/CQRS برای کوئری‌های سمت سرور است؛ مسیر داده‌ی اپ
  از Supabase (PostgREST + RLS) می‌گذرد.
- اعمال روی Supabase: SQL Editor یا `psql` با `DATABASE_URL` (جزئیات در README).
- وضعیت فعلی پروژه Supabase: جداول نسخه قبلی در schema `legacy_backup`
  (بدون دسترسی `anon`/`authenticated`) آرشیو شده‌اند و schema جدید از صفر ساخته شده است.
