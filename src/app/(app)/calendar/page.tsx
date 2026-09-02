import { CalendarBoard } from "@/features/calendar/components/calendar-board";
import type { EventRecord } from "@/features/calendar/types";
import type { CalendarChoreSource } from "@/features/chores/calendar-items";
import type { ChoreFrequency } from "@/features/chores/types";
import type { TaskRecord } from "@/features/tasks/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ErrorState } from "@/shared/ui/error-state";
import { PageHeader } from "@/shared/ui/page-header";

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

  let choreSources: CalendarChoreSource[] = [];
  let choreMembers: { userId: string; fullName: string }[] = [];

  if (householdId) {
    const [choresResult, membersResult] = await Promise.all([
      supabase
        .from("chores")
        .select(
          "id, title, description, is_active, start_date, default_assignee_id, chore_recurrences(frequency, interval_days, weekdays), chore_rotations(user_id, position)",
        )
        .eq("household_id", householdId)
        .eq("is_active", true),
      supabase
        .from("household_members")
        .select("user_id")
        .eq("household_id", householdId)
        .is("left_at", null),
    ]);

    // chores failure must not kill calendar
    if (!choresResult.error) {
      const choreRows = choresResult.data ?? [];
      const choreIds = choreRows.map((row) => row.id);

      // chore_completions has NO household_id — filter by chore_id list
      const completionsByChore = new Map<string, string[]>();

      if (choreIds.length > 0) {
        const completionsResult = await supabase
          .from("chore_completions")
          .select("chore_id, for_date")
          .in("chore_id", choreIds);

        if (!completionsResult.error) {
          for (const row of completionsResult.data ?? []) {
            const list = completionsByChore.get(row.chore_id) ?? [];
            list.push(row.for_date);
            completionsByChore.set(row.chore_id, list);
          }
        }
      }

      choreSources = choreRows.map((row) => {
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
          completedDates: completionsByChore.get(row.id) ?? [],
        };
      });
    }

    if (!membersResult.error) {
      const userIds = (membersResult.data ?? []).map((m) => m.user_id);
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
        for (const p of profilesResult.data ?? []) {
          nameById.set(p.id, p.full_name || "کاربر");
        }
      }

      choreMembers = userIds.map((userId) => ({
        userId,
        fullName: nameById.get(userId) ?? "کاربر",
      }));
    }
  }

  return (
    <div className="space-y-7">
      <PageHeader
        title="تقویم"
        subtitle="رویدادها، تسک‌ها و کارهای خانه در نمای جلالی."
      />

      <CalendarBoard
        tasks={(tasksResult.data ?? []) as TaskRecord[]}
        events={(eventsResult.data ?? []) as EventRecord[]}
        chores={choreSources}
        choreMembers={choreMembers}
        householdId={householdId}
      />
    </div>
  );
}
