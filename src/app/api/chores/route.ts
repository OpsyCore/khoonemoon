import { NextResponse } from "next/server";
import { createChoreSchema } from "@/features/chores/schemas";
import {
  getSessionContext,
  requireHousehold,
  serverError,
  validationError,
} from "@/lib/api/session";

const CHORE_SELECT =
  "id, household_id, title, description, created_by, rotation_mode, current_rotation_index, frequency, interval_days, weekdays, next_due_at, is_active, archived_at, created_at, updated_at, chore_rotation_steps(id, chore_id, position, assignee_id)";

export async function GET() {
  const session = await getSessionContext();
  if (!session.ok) return session.response;

  const { supabase, householdId } = session.context;

  if (!householdId) {
    return NextResponse.json({ chores: [], completions: [] });
  }

  const [choresResult, completionsResult] = await Promise.all([
    supabase
      .from("chores")
      .select(CHORE_SELECT)
      .eq("household_id", householdId)
      .is("archived_at", null)
      .order("next_due_at", { ascending: true, nullsFirst: false }),
    supabase
      .from("chore_completions")
      .select("id, chore_id, completed_by, completed_at, due_at, note")
      .order("completed_at", { ascending: false })
      .limit(30),
  ]);

  if (choresResult.error) return serverError("دریافت کارهای خانه ناموفق بود.");
  if (completionsResult.error)
    return serverError("دریافت تاریخچه کارهای خانه ناموفق بود.");

  return NextResponse.json({
    chores: choresResult.data ?? [],
    completions: completionsResult.data ?? [],
  });
}

export async function POST(request: Request) {
  const session = await getSessionContext();
  if (!session.ok) return session.response;

  const { supabase, userId, householdId } = session.context;
  const guard = requireHousehold(session.context);
  if (guard) return guard;

  const parsed = createChoreSchema.safeParse(await request.json());
  if (!parsed.success) return validationError(parsed.error);

  const { data: chore, error } = await supabase
    .from("chores")
    .insert({
      household_id: householdId,
      title: parsed.data.title,
      description: parsed.data.description || null,
      created_by: userId,
      rotation_mode: parsed.data.rotationMode,
      frequency: parsed.data.frequency,
      interval_days: parsed.data.intervalDays ?? null,
      weekdays: parsed.data.weekdays ?? null,
      next_due_at: parsed.data.nextDueAt ?? null,
    })
    .select("id")
    .single();

  if (error || !chore) return serverError("ایجاد کار خانه ناموفق بود.");

  const assigneeIds = parsed.data.assigneeIds.length
    ? parsed.data.assigneeIds
    : [userId];

  const { error: stepsError } = await supabase
    .from("chore_rotation_steps")
    .insert(
      assigneeIds.map((assigneeId, position) => ({
        chore_id: chore.id,
        position,
        assignee_id: assigneeId,
      })),
    );

  if (stepsError) return serverError("ثبت نوبت‌بندی کار خانه ناموفق بود.");

  return NextResponse.json({ id: chore.id }, { status: 201 });
}
