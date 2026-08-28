# SECURITY_TESTS.md

## Milestone 3 Critical Security Verification

این سناریوها باید در محیط Supabase (با دو کاربر واقعی) اجرا شوند.

## Scenario 1: User cannot access another household

1. User A یک household بسازد.
2. User B یک household جداگانه بسازد.
3. User A تلاش کند از API خانه، household مربوط به User B را بخواند.

Expected:

- RLS باید دسترسی را deny کند (یا result خالی برگردد).

## Scenario 2: Partner cannot access private records

> در Milestone 3 هنوز ماژول tasks/records خصوصی کامل پیاده‌سازی نشده است.  
> برای تضمین منطقی، تست unit روی گارد `canAccessPrivateRecord` اضافه شده است.

Expected:

- برای visibility=PRIVATE، فقط owner اجازه دسترسی داشته باشد.

## Scenario 3: Invitation cannot be reused incorrectly

1. Owner یک دعوت‌نامه ایجاد کند.
2. Partner با کد دعوت join کند.
3. همان کد دوباره توسط کاربر دیگر یا همان کاربر استفاده شود.

Expected:

- RPC `join_household_with_invitation` خطای `INVITATION_NOT_PENDING` بدهد.
- invitation status باید `ACCEPTED` بماند.

## Scenario 4: Unauthorized users cannot modify membership

1. User غیرمالک تلاش کند دعوت‌نامه را لغو کند.
2. User غیرمالک تلاش کند دعوت‌نامه جدید بسازد.
3. User عادی تلاش کند مستقیم در `household_members` insert/update/delete انجام دهد.

Expected:

- مورد 1 و 2 خطای permission/domain error.
- مورد 3 به دلیل نبود policy مستقیم روی `household_members` deny شود.

## Automated Test Coverage (Milestone 3)

- `src/features/households/security.test.ts`
  - cannot access another household
  - partner cannot access private records
  - invitation reuse rejected
  - unauthorized membership modification rejected

## Milestone 9 Finance verification

These scenarios should be run in Supabase with two users.

### Scenario F1: Partner cannot read a private bill

1. User A creates a PRIVATE bill.
2. User B (same household) lists `/api/finance`.

Expected: User B does not see User A's private bill.

### Scenario F2: Shared bill is visible to household members only

1. User A creates a HOUSEHOLD_SHARED bill.
2. User B (same household) can read and mark it paid.
3. User C in another household cannot read it.

### Scenario F3: Shared finance requires household membership

1. User with no household posts `visibility=HOUSEHOLD_SHARED`.

Expected: `NO_HOUSEHOLD_FOR_SHARED_FINANCE`.

### Scenario F4: paid_by must be a valid payer

1. On a PRIVATE bill, `paid_by` other than owner is rejected.
2. On a SHARED bill, `paid_by` outside the household is rejected.

### Automated coverage

- `src/app/api/finance/finance-api.test.ts`
- `src/features/finance/security.test.ts`
- `src/features/finance/schemas.test.ts`
- `src/features/finance/status.test.ts`
- `src/features/finance/today.test.ts`
- `src/features/finance/server.test.ts`
