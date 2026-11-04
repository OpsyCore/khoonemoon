import type { CalendarChore } from "@/features/chores/calendar-projection";
import { directCalendar } from "@/features/calendar/direct-client";
import { directChores } from "@/features/chores/direct-client";
import { directFinance } from "@/features/finance/direct-client";
import { directTasks } from "@/features/tasks/direct-client";
import { CalendarBoard } from "@/features/calendar/components/calendar-board";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ErrorState } from "@/shared/ui/error-state";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return (
      <ErrorState
        title="دسترسی غیرمجاز"
        description="برای مشاهده تقویم باید وارد حساب شوید."
      />
    );

  const membership = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", user.id)
    .is("left_at", null)
    .maybeSingle();
  if (membership.error)
    return (
      <ErrorState
        title="خطا در بارگذاری تقویم"
        description="لطفاً دوباره تلاش کنید."
      />
    );
  const householdId = membership.data?.household_id ?? null;
  // All collections use stable pagination. In particular, PostgREST's default
  // 1000-row limit must not silently hide calendar entries on the web.
  const [tasks, events, financial, chores] = await Promise.allSettled([
    directTasks(supabase).list(),
    directCalendar(supabase).list(),
    directFinance(supabase).list(),
    householdId
      ? directChores(supabase).list(householdId)
      : Promise.resolve([]),
  ]);
  if (tasks.status === "rejected" || events.status === "rejected") {
    return (
      <ErrorState
        title="خطا در بارگذاری تقویم"
        description="لطفاً دوباره تلاش کنید."
      />
    );
  }
  const calendarChores: CalendarChore[] =
    chores.status === "fulfilled"
      ? chores.value
          .filter((chore) => chore.is_active && chore.next_due_at !== null)
          .map((chore) => ({
            id: chore.id,
            title: chore.title,
            next_due_at: chore.next_due_at!,
            frequency: chore.frequency,
            interval_days: chore.interval_days,
            weekdays: chore.weekdays,
            recurrence_timezone: chore.recurrence_timezone,
            completion_revision: chore.completion_revision,
          }))
      : [];
  return (
    <div className="space-y-4">
      <CalendarBoard
        tasks={tasks.value}
        events={events.value}
        householdId={householdId}
        chores={calendarChores}
        choresLoadError={chores.status === "rejected"}
        bills={financial.status === "fulfilled" ? financial.value : []}
        billsLoadError={financial.status === "rejected"}
      />
    </div>
  );
}
