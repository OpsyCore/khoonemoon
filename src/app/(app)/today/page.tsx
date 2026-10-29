import Link from "next/link";
import type { EventRecord } from "@/features/calendar/types";
import { DueChores } from "@/features/chores/components/due-chores";
import type { ChoreRecord } from "@/features/chores/types";
import { UpcomingBills } from "@/features/finance/components/upcoming-bills";
import type { FinancialRecord } from "@/features/finance/types";
import { calculateUpcomingReminders } from "@/features/reminders/calculations";
import { UpcomingReminders } from "@/features/reminders/components/upcoming-reminders";
import type { ReminderRecord } from "@/features/reminders/types";
import { TaskManager } from "@/features/tasks/components/task-manager";
import { TodayDashboard } from "@/features/tasks/components/today-dashboard";
import type { TaskMember, TaskRecord } from "@/features/tasks/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ErrorState } from "@/shared/ui/error-state";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <ErrorState
        title="دسترسی غیرمجاز"
        description="برای مشاهده تسک‌ها باید وارد حساب شوید."
      />
    );
  }

  const [
    membershipResult,
    tasksResult,
    eventsResult,
    remindersResult,
    choresResult,
    financeResult,
  ] = await Promise.all([
    supabase
      .from("household_members")
      .select("household_id")
      .eq("user_id", user.id)
      .is("left_at", null)
      .maybeSingle(),
    supabase
      .from("tasks")
      .select(
        "id, title, description, creator_id, owner_id, household_id, visibility, status, priority, due_at, completed_at, archived_at, created_at, updated_at, task_assignees(assignee_id), task_recurrences(frequency, interval_days, weekdays)",
      )
      .is("archived_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("events")
      .select(
        "id, title, description, creator_id, owner_id, household_id, visibility, start_at, end_at, all_day, location, created_at, updated_at",
      )
      .order("start_at", { ascending: true }),
    supabase
      .from("reminders")
      .select(
        "id, target_type, target_id, user_id, household_id, remind_at, status, snoozed_until, snooze_count, delivered_at, created_at, updated_at",
      )
      .eq("user_id", user.id)
      .in("status", ["PENDING", "SNOOZED"])
      .order("remind_at", { ascending: true }),
    supabase
      .from("chores")
      .select(
        "id, household_id, title, description, created_by, rotation_mode, current_rotation_index, frequency, interval_days, weekdays, next_due_at, is_active, archived_at, created_at, updated_at, chore_rotation_steps(id, chore_id, position, assignee_id)",
      )
      .is("archived_at", null)
      .order("next_due_at", { ascending: true, nullsFirst: false }),
    supabase
      .from("financial_records")
      .select(
        "id, household_id, owner_id, created_by, visibility, record_type, title, amount, currency, category, note, occurred_at, due_at, bill_status, is_recurring, recurrence_rule, paid_by, paid_at, archived_at, created_at, updated_at",
      )
      .is("archived_at", null)
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(50),
  ]);

  if (
    membershipResult.error ||
    tasksResult.error ||
    eventsResult.error ||
    remindersResult.error
  ) {
    return (
      <ErrorState
        title="خطا در دریافت اطلاعات امروز"
        description="لطفاً دوباره تلاش کنید."
      />
    );
  }

  const householdId = membershipResult.data?.household_id ?? null;

  const memberListResult = householdId
    ? await supabase
        .from("household_members")
        .select("user_id, profiles(full_name)")
        .eq("household_id", householdId)
        .is("left_at", null)
    : { data: [], error: null };

  if (memberListResult.error) {
    return (
      <ErrorState
        title="خطا در دریافت اعضا"
        description="لطفاً دوباره تلاش کنید."
      />
    );
  }

  const members = (
    (memberListResult.data ?? []) as {
      user_id: string;
      profiles: { full_name: string }[] | null;
    }[]
  ).map((item) => ({
    user_id: item.user_id,
    full_name: item.profiles?.[0]?.full_name ?? "کاربر",
  })) as TaskMember[];

  const effectiveMembers =
    members.length > 0
      ? members
      : [
          {
            user_id: user.id,
            full_name: "من",
          },
        ];

  const tasks = (tasksResult.data ?? []) as TaskRecord[];
  const events = (eventsResult.data ?? []) as EventRecord[];
  const upcomingReminders = calculateUpcomingReminders({
    reminders: (remindersResult.data ?? []) as ReminderRecord[],
    now: new Date(),
    horizonHours: 72,
  });

  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">امروز چه کارهایی داریم؟</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          مرور سریع کارهای معوق، برنامه امروز و رویدادهای پیش‌رو با امکان اقدام
          فوری.
        </p>
      </section>

      <TodayDashboard tasks={tasks} events={events} />
      <DueChores
        chores={(choresResult.data ?? []) as ChoreRecord[]}
        members={effectiveMembers}
      />
      <UpcomingBills
        records={(financeResult.data ?? []) as FinancialRecord[]}
      />
      <UpcomingReminders reminders={upcomingReminders as ReminderRecord[]} />

      <Link
        href="/reminders"
        className="block rounded-3xl border border-zinc-200 bg-white p-4 text-center text-sm font-medium text-sky-700 shadow-sm transition hover:bg-sky-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-sky-300 dark:hover:bg-sky-950/30"
      >
        همهٔ یادآورها — شامل تحویل‌شده‌ها و لغو‌شده‌ها
      </Link>

      <TaskManager
        tasks={tasks}
        members={effectiveMembers}
        householdId={householdId}
        userId={user.id}
      />
    </div>
  );
}
