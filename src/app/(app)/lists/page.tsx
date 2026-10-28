import { ListsTabs } from "@/features/lists/components/lists-tabs";
import type { ChoreRecord } from "@/features/chores/types";
import type { FinancialRecord } from "@/features/finance/types";
import type { ShoppingItem, ShoppingList } from "@/features/shopping/types";
import type { TaskMember } from "@/features/tasks/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ErrorState } from "@/shared/ui/error-state";

export const dynamic = "force-dynamic";

export default async function ListsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <ErrorState
        title="دسترسی غیرمجاز"
        description="برای مشاهده لیست‌ها باید وارد حساب شوید."
      />
    );
  }

  const { data: membership } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", user.id)
    .is("left_at", null)
    .maybeSingle();

  const householdId = (membership?.household_id as string | undefined) ?? null;

  const [listsResult, choresResult, recordsResult] = await Promise.all([
    householdId
      ? supabase
          .from("shopping_lists")
          .select(
            "id, household_id, name, created_by, archived_at, created_at, updated_at",
          )
          .eq("household_id", householdId)
          .is("archived_at", null)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    householdId
      ? supabase
          .from("chores")
          .select(
            "id, household_id, title, description, created_by, rotation_mode, current_rotation_index, frequency, interval_days, weekdays, next_due_at, is_active, archived_at, created_at, updated_at, chore_rotation_steps(id, chore_id, position, assignee_id)",
          )
          .eq("household_id", householdId)
          .is("archived_at", null)
          .order("next_due_at", { ascending: true, nullsFirst: false })
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("financial_records")
      .select(
        "id, household_id, owner_id, created_by, visibility, record_type, title, amount, currency, category, note, occurred_at, due_at, bill_status, is_recurring, recurrence_rule, paid_by, paid_at, archived_at, created_at, updated_at",
      )
      .is("archived_at", null)
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(100),
  ]);

  if (listsResult.error || choresResult.error || recordsResult.error) {
    return (
      <ErrorState
        title="خطا در بارگذاری لیست‌ها"
        description="اطلاعات خرید، کارهای خانه یا مالی قابل دریافت نیست. لطفاً دوباره تلاش کنید."
      />
    );
  }

  const lists = (listsResult.data ?? []) as ShoppingList[];
  const activeListId = lists[0]?.id ?? null;

  const itemsResult = activeListId
    ? await supabase
        .from("shopping_items")
        .select(
          "id, list_id, name, quantity, unit, category, note, added_by, purchased, purchased_by, purchased_at, position, created_at, updated_at",
        )
        .eq("list_id", activeListId)
        .order("purchased", { ascending: true })
        .order("position", { ascending: true })
    : { data: [], error: null };

  if (itemsResult.error) {
    return (
      <ErrorState
        title="خطا در بارگذاری لیست خرید"
        description="آیتم‌های خرید قابل دریافت نیستند."
      />
    );
  }

  const membersResult = householdId
    ? await supabase
        .from("household_members")
        .select("user_id, profiles(full_name)")
        .eq("household_id", householdId)
        .is("left_at", null)
    : { data: [], error: null };

  const members: TaskMember[] = (
    (membersResult.data ?? []) as {
      user_id: string;
      profiles: { full_name: string }[] | null;
    }[]
  ).map((member) => ({
    user_id: member.user_id,
    full_name: member.profiles?.[0]?.full_name ?? "کاربر",
  }));

  const effectiveMembers = members.length
    ? members
    : [{ user_id: user.id, full_name: "من" }];

  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">لیست‌ها</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          خرید مشترک با هم‌زمان‌سازی زنده، کارهای خانه نوبتی و قبض‌ها در یک جا.
        </p>
      </section>

      <ListsTabs
        lists={lists}
        items={(itemsResult.data ?? []) as ShoppingItem[]}
        chores={(choresResult.data ?? []) as ChoreRecord[]}
        records={(recordsResult.data ?? []) as FinancialRecord[]}
        members={effectiveMembers}
        activeListId={activeListId}
        canShare={Boolean(householdId)}
      />
    </div>
  );
}
