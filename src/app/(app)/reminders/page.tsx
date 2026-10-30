import { PageHeader } from "@/shared/ui/page-header";
import { ReminderInbox } from "@/features/reminders/components/reminder-inbox";
import type { ReminderTarget } from "@/features/reminders/inbox";
import type { ReminderRecord } from "@/features/reminders/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ErrorState } from "@/shared/ui/error-state";

export const dynamic = "force-dynamic";

const REMINDER_SELECT =
  "id, target_type, target_id, user_id, household_id, remind_at, status, snoozed_until, snooze_count, delivered_at, created_at, updated_at";

/**
 * صندوق یادآورها — every reminder of the signed-in user, including the ones
 * that already fired or were cancelled, which no other screen shows.
 */
export default async function RemindersPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <ErrorState
        title="دسترسی غیرمجاز"
        description="برای دیدن یادآورها باید وارد حساب شوید."
      />
    );
  }

  const remindersResult = await supabase
    .from("reminders")
    .select(REMINDER_SELECT)
    .eq("user_id", user.id)
    .order("remind_at", { ascending: false })
    .limit(100);

  if (remindersResult.error) {
    return (
      <ErrorState
        title="خطا در بارگذاری یادآورها"
        description="فهرست یادآورها قابل دریافت نیست. لطفاً دوباره تلاش کنید."
      />
    );
  }

  const reminders = (remindersResult.data ?? []) as ReminderRecord[];

  // Titles come from the targets themselves, scoped to the ids that are actually
  // referenced, so a deleted task can be labelled honestly instead of blank.
  const taskIds = [
    ...new Set(
      reminders
        .filter((reminder) => reminder.target_type === "TASK")
        .map((reminder) => reminder.target_id),
    ),
  ];
  const eventIds = [
    ...new Set(
      reminders
        .filter((reminder) => reminder.target_type === "EVENT")
        .map((reminder) => reminder.target_id),
    ),
  ];

  const [tasksResult, eventsResult] = await Promise.all([
    taskIds.length
      ? supabase.from("tasks").select("id, title").in("id", taskIds)
      : Promise.resolve({ data: [], error: null }),
    eventIds.length
      ? supabase.from("events").select("id, title").in("id", eventIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const tasks = (tasksResult.data ?? []) as ReminderTarget[];
  const events = (eventsResult.data ?? []) as ReminderTarget[];

  return (
    <div className="space-y-4">
      <PageHeader
        title="صندوق یادآورها"
        subtitle="یادآورهای رسیده، آینده، تحویل‌داده‌شده و لغوشده در یک جا."
        decor
      />

      <ReminderInbox
        reminders={reminders}
        tasks={tasks}
        events={events}
        now={new Date()}
      />
    </div>
  );
}
