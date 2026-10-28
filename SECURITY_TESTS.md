# SECURITY_TESTS.md

## چطور اجرا می‌شود

سه لایه بررسی امنیتی داریم:

| لایه                    | ابزار                       | محل                               |
| ----------------------- | --------------------------- | --------------------------------- |
| منطق مجوز (unit)        | Vitest                      | `src/features/*/security.test.ts` |
| سیاست‌های RLS (DB)      | SQL با `request.jwt.claims` | همان اسناد زیر / اجرای دستی       |
| مسیرهای واقعی API (e2e) | `npm run smoke`             | `scripts/smoke.mjs`               |

برای لایه دوم، هر بلوک زیر را داخل یک تراکنش اجرا کنید تا نقش و claims ست شود:

```sql
begin;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '<user-uuid>', 'role', 'authenticated')::text,
  true
);
set local role authenticated;
-- assertion
commit;
```

## Milestone 3 — Boundary tests

### Scenario 1: کاربر عضو خانه دیگری نیست

- انتظار: `select count(*) from households` برای کاربر بیرونی = 0
- وضعیت: ✅ اجرا شد (نتیجه: 0 خانه، 0 تسک، 0 آیتم خرید، 0 نتیجه جستجو)

### Scenario 2: شریک، رکورد خصوصی طرف مقابل را نمی‌بیند

- انتظار: کاربر A فقط تسک خصوصی خودش + تسک مشترک خانه را ببیند
- وضعیت: ✅ اجرا شد (نتیجه: 2 تسک از 3؛ تسک خصوصی B دیده نشد)
- تست منطقی مکمل: `src/features/tasks/security.test.ts`

### Scenario 3: دعوت‌نامه دوباره قابل استفاده نیست

- انتظار: RPC `join_household_with_invitation` خطای `INVITATION_NOT_PENDING` بدهد
- تست منطقی: `src/features/households/security.test.ts`
- تست DB: پس از accept، status = ACCEPTED باقی بماند

### Scenario 4: کاربر غیرمالک نمی‌تواند عضویت/دعوت را تغییر دهد

- انتظار: نبود policy برای insert/update/delete مستقیم روی `household_members`
  و `household_invitations` → رد شدن
- وضعیت: ✅ سیاست‌ها فاقد این policyها هستند و grant مستقیم هم ندارند

## Milestone 7 — Chores

- [x] کاربر بیرونی به `chores` خانه دیگر دسترسی ندارد (RLS + `is_household_member`)
- [x] `chore_completions` فقط خواندنی است؛ نوشتن تنها از طریق `complete_chore`
- [x] `complete_chore` برای کاربر غیرعضو خطای `NOT_HOUSEHOLD_MEMBER` می‌دهد
- [x] چرخش نوبت با `mod` تعداد مراحل انجام می‌شود (تست واحد + تست DB:
      ایندکس 0 → 1 و `next_due_at` به آینده منتقل شد)

## Milestone 8 — Shopping & Realtime

- [x] فقط اعضای خانه به `shopping_lists`/`shopping_items` دسترسی دارند
- [x] `added_by` باید برابر کاربر جاری باشد
- [x] realtime فقط روی جداول مجاز منتشر می‌شود (هیچ داده‌ای از RLS عبور نمی‌کند؛
      realtime پیام‌ها را بر اساس RLS فیلتر می‌کند)

## Milestone 9 — Finance

- [x] رکورد PRIVATE هیچ‌گاه `household_id` ندارد (constraint + policy)
- [x] رکورد HOUSEHOLD_SHARED بدون `household_id` رد می‌شود
- [x] کاربر بیرونی هیچ رکورد مالی خانه را نمی‌بیند

## Milestone 10 — Search

- [x] `search_workspace` به‌صورت invoker اجرا می‌شود (بدون `security definer`) تا RLS اعمال شود
- [x] برای کاربر بیرونی، جستجوی عبارتی که در خانه دیگری وجود دارد → 0 نتیجه
- [x] `p_limit` حداکثر 50 تا از بار زیاد جلوگیری شود

## تست دود خودکار (e2e)

```bash
APP_URL=http://localhost:3000 npm run smoke
```

پوشش:

1. دسترسی ناشناس به API → 401
2. ساخت پروفایل خودکار هنگام ثبت‌نام
3. ساخت خانه با RPC
4. رندر صفحات `/today` و `/lists` برای کاربر وارد‌شده
5. چرخه خرید: ساخت لیست → افزودن آیتم → خریداری‌شده
6. چرخه کار خانه: ساخت → تکمیل → زمان‌بندی بعدی
7. چرخه مالی: ثبت قبض → وضعیت OVERDUE
8. جستجو برای عضو خانه → نتیجه؛ برای کاربر بیرونی → خالی
9. پاک‌سازی کاربران تستی در پایان
