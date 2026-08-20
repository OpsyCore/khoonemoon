import type { EventRecord } from "@/features/calendar/types";
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
        : { data: [] as { id: string; full_name: string | null }[], error: null };

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
    }
  }

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

      <UpcomingReminders
        reminders={upcomingReminders as ReminderRecord[]}
      />

      <TaskManager
        tasks={tasks}
        members={effectiveMembers}
        householdId={householdId}
        userId={user.id}
      />
    </div>
  );
}
