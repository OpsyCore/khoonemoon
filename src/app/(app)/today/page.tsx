import type { EventRecord } from "@/features/calendar/types";
import { TodayChores } from "@/features/chores/components/today-chores";
import { TodayBills } from "@/features/finance/components/today-bills";
import { buildTodayBillItems } from "@/features/finance/today";
import {
  buildTodayChoreItems,
  toDateOnlyLocal,
  type TodayChoreSource,
} from "@/features/chores/today";
import type { ChoreFrequency } from "@/features/chores/types";
import { calculateUpcomingReminders } from "@/features/reminders/calculations";
import { UpcomingReminders } from "@/features/reminders/components/upcoming-reminders";
import type { ReminderRecord } from "@/features/reminders/types";
import { TaskManager } from "@/features/tasks/components/task-manager";
import { TodayDashboard } from "@/features/tasks/components/today-dashboard";
import type { TaskMember, TaskRecord } from "@/features/tasks/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ErrorState } from "@/shared/ui/error-state";
import { PageHeader } from "@/shared/ui/page-header";
import { formatJalaliLongDate } from "@/shared/utils/jalali";

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

  const [membershipResult, tasksResult, eventsResult, remindersResult] =
    await Promise.all([
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
    ]);

  if (
    membershipResult.error ||
    tasksResult.error ||
    eventsResult.error ||
    remindersResult.error
  ) {
    const detail =
      membershipResult.error?.message ||
      tasksResult.error?.message ||
      eventsResult.error?.message ||
      remindersResult.error?.message ||
      "لطفاً دوباره تلاش کنید.";

    return (
      <ErrorState title="خطا در دریافت اطلاعات امروز" description={detail} />
    );
  }

  const householdId = membershipResult.data?.household_id ?? null;

  let effectiveMembers: TaskMember[] = [
    {
      user_id: user.id,
      full_name: "من",
    },
  ];

  let todayChoreItems: ReturnType<typeof buildTodayChoreItems> = [];
  let choreMembers: { userId: string; fullName: string }[] = [
    { userId: user.id, fullName: "من" },
  ];

  if (householdId) {
    const memberListResult = await supabase
      .from("household_members")
      .select("user_id")
      .eq("household_id", householdId)
      .is("left_at", null);

    if (memberListResult.error) {
      return (
        <ErrorState
          title="خطا در دریافت اعضا"
          description={memberListResult.error.message}
        />
      );
    }

    const memberRows = memberListResult.data ?? [];
    const userIds = memberRows.map((row) => row.user_id);

    const profilesResult =
      userIds.length > 0
        ? await supabase
            .from("profiles")
            .select("id, full_name")
            .in("id", userIds)
        : {
            data: [] as { id: string; full_name: string | null }[],
            error: null,
          };

    const nameById = new Map<string, string>();
    if (!profilesResult.error) {
      for (const profile of profilesResult.data ?? []) {
        nameById.set(profile.id, profile.full_name || "کاربر");
      }
    }

    if (memberRows.length > 0) {
      effectiveMembers = memberRows.map((row) => ({
        user_id: row.user_id,
        full_name: nameById.get(row.user_id) ?? "کاربر",
      }));
      choreMembers = effectiveMembers.map((m) => ({
        userId: m.user_id,
        fullName: m.full_name,
      }));
    }

    const today = toDateOnlyLocal();
    const lookbackStart = (() => {
      const [y, m, d] = today.split("-").map(Number);
      const dt = new Date(Date.UTC(y, m - 1, d));
      dt.setUTCDate(dt.getUTCDate() - 14);
      return dt.toISOString().slice(0, 10);
    })();

    const [choresResult, completionsResult] = await Promise.all([
      supabase
        .from("chores")
        .select(
          "id, title, description, is_active, start_date, default_assignee_id, chore_recurrences(frequency, interval_days, weekdays), chore_rotations(user_id, position)",
        )
        .eq("household_id", householdId)
        .eq("is_active", true),
      supabase
        .from("chore_completions")
        .select("chore_id, for_date")
        .gte("for_date", lookbackStart)
        .lte("for_date", today),
    ]);

    // chores failure should not kill whole Today — show empty chores
    if (!choresResult.error) {
      const completionsByChore = new Map<string, Set<string>>();
      if (!completionsResult.error) {
        for (const row of completionsResult.data ?? []) {
          const set = completionsByChore.get(row.chore_id) ?? new Set<string>();
          set.add(row.for_date);
          completionsByChore.set(row.chore_id, set);
        }
      }

      const sources: TodayChoreSource[] = (choresResult.data ?? []).map(
        (row) => {
          const rec = Array.isArray(row.chore_recurrences)
            ? row.chore_recurrences[0]
            : row.chore_recurrences;
          const rotations = Array.isArray(row.chore_rotations)
            ? [...row.chore_rotations].sort(
                (a, b) => (a.position ?? 0) - (b.position ?? 0),
              )
            : [];

          return {
            id: row.id,
            title: row.title,
            description: row.description ?? null,
            isActive: row.is_active ?? true,
            startDate: row.start_date,
            defaultAssigneeId: row.default_assignee_id ?? null,
            frequency: (rec?.frequency ?? "NONE") as ChoreFrequency,
            intervalDays: rec?.interval_days ?? null,
            weekdays: rec?.weekdays ?? null,
            rotationUserIds: rotations.map((r) => r.user_id),
            completedDates: completionsByChore.get(row.id) ?? new Set<string>(),
          };
        },
      );

      todayChoreItems = buildTodayChoreItems(sources, today, 14);
    }
  }

  let todayBillItems: ReturnType<typeof buildTodayBillItems> = [];
  const billsResult = await supabase
    .from("finance_records")
    .select("id, record_type, title, amount, currency, due_at, paid_at")
    .eq("record_type", "BILL")
    .is("paid_at", null);

  if (!billsResult.error) {
    todayBillItems = buildTodayBillItems(billsResult.data ?? [], new Date());
  }

  const tasks = (tasksResult.data ?? []) as TaskRecord[];
  const events = (eventsResult.data ?? []) as EventRecord[];
  const upcomingReminders = calculateUpcomingReminders({
    reminders: (remindersResult.data ?? []) as ReminderRecord[],
    now: new Date(),
    horizonHours: 72,
  });

  return (
    <div className="space-y-7">
      <PageHeader
        title="امروز"
        subtitle={`${formatJalaliLongDate(new Date())} · برنامه و کارهای امروزِ ما`}
        decor
      />

      <TodayDashboard tasks={tasks} events={events} />

      <TodayBills items={todayBillItems} />

      <TodayChores items={todayChoreItems} members={choreMembers} />

      <UpcomingReminders reminders={upcomingReminders as ReminderRecord[]} />

      <TaskManager
        tasks={tasks}
        members={effectiveMembers}
        householdId={householdId}
        userId={user.id}
      />
    </div>
  );
}
