import { CalendarBoard } from "@/features/calendar/components/calendar-board";
import type { EventRecord } from "@/features/calendar/types";
import type { TaskRecord } from "@/features/tasks/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ErrorState } from "@/shared/ui/error-state";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <ErrorState
        title="دسترسی غیرمجاز"
        description="برای مشاهده تقویم باید وارد حساب شوید."
      />
    );
  }

  const [membershipResult, tasksResult, eventsResult] = await Promise.all([
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
      .is("archived_at", null),
    supabase
      .from("events")
      .select(
        "id, title, description, creator_id, owner_id, household_id, visibility, start_at, end_at, all_day, location, created_at, updated_at",
      )
      .order("start_at", { ascending: true }),
  ]);

  if (membershipResult.error || tasksResult.error || eventsResult.error) {
    return (
      <ErrorState
        title="خطا در بارگذاری تقویم"
        description="لطفاً دوباره تلاش کنید."
      />
    );
  }

  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">تقویم مشترک</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          رویدادها و تسک‌ها را در نمای جلالی ماهانه، هفتگی و فهرستی مدیریت کنید.
        </p>
      </section>

      <CalendarBoard
        tasks={(tasksResult.data ?? []) as TaskRecord[]}
        events={(eventsResult.data ?? []) as EventRecord[]}
        householdId={membershipResult.data?.household_id ?? null}
      />
    </div>
  );
}
