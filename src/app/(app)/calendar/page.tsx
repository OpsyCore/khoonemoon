import type { CalendarChore } from "@/features/chores/calendar-projection";
import { PageHeader } from "@/shared/ui/page-header";
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

  const householdId = membershipResult.data?.household_id ?? null;
  const choresResult = householdId
    ? await supabase
        .from("chores")
        .select("id, title, next_due_at, frequency, interval_days, weekdays")
        .eq("household_id", householdId)
        .eq("is_active", true)
        .is("archived_at", null)
        .not("next_due_at", "is", null)
    : { data: [], error: null };

  return (
    <div className="space-y-4">
      <PageHeader
        title="تقویم مشترک"
        subtitle="رویدادها و تسک‌ها را در نمای جلالی ماهانه، هفتگی و فهرستی مدیریت کنید."
        decor
      />

      <CalendarBoard
        tasks={(tasksResult.data ?? []) as TaskRecord[]}
        events={(eventsResult.data ?? []) as EventRecord[]}
        householdId={householdId}
        chores={(choresResult.data ?? []) as CalendarChore[]}
        choresLoadError={Boolean(choresResult.error)}
      />
    </div>
  );
}
