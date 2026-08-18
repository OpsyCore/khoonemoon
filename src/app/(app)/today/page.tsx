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
