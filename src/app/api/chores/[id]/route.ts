import { NextResponse } from "next/server";
import { updateChoreSchema } from "@/features/chores/schemas";
import {
  getSessionContext,
  serverError,
  validationError,
} from "@/lib/api/session";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const session = await getSessionContext();
  if (!session.ok) return session.response;

  const { supabase } = session.context;

  const parsed = updateChoreSchema.safeParse(await request.json());
  if (!parsed.success) return validationError(parsed.error);

  const patch: Record<string, unknown> = {};

  if (parsed.data.title !== undefined) patch.title = parsed.data.title;
  if (parsed.data.description !== undefined)
    patch.description = parsed.data.description;
  if (parsed.data.isActive !== undefined) patch.is_active = parsed.data.isActive;
  if (parsed.data.frequency !== undefined)
    patch.frequency = parsed.data.frequency;
  if (parsed.data.intervalDays !== undefined)
    patch.interval_days = parsed.data.intervalDays;
  if (parsed.data.weekdays !== undefined) patch.weekdays = parsed.data.weekdays;
  if (parsed.data.nextDueAt !== undefined)
    patch.next_due_at = parsed.data.nextDueAt;
  if (parsed.data.rotationMode !== undefined)
    patch.rotation_mode = parsed.data.rotationMode;

  if (Object.keys(patch).length === 0 && !parsed.data.assigneeIds) {
    return NextResponse.json({ message: "تغییری ارسال نشد." }, { status: 400 });
  }

  if (Object.keys(patch).length > 0) {
    const { error } = await supabase
      .from("chores")
      .update(patch)
      .eq("id", id);

    if (error) return serverError("به‌روزرسانی کار خانه ناموفق بود.");
  }

  if (parsed.data.assigneeIds) {
    const { error: deleteError } = await supabase
      .from("chore_rotation_steps")
      .delete()
      .eq("chore_id", id);

    if (deleteError) return serverError("به‌روزرسانی نوبت‌بندی ناموفق بود.");

    if (parsed.data.assigneeIds.length > 0) {
      const { error: insertError } = await supabase
        .from("chore_rotation_steps")
        .insert(
          parsed.data.assigneeIds.map((assigneeId, position) => ({
            chore_id: id,
            position,
            assignee_id: assigneeId,
          })),
        );

      if (insertError) return serverError("ثبت نوبت‌بندی ناموفق بود.");
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const session = await getSessionContext();
  if (!session.ok) return session.response;

  const { supabase } = session.context;

  const { error } = await supabase
    .from("chores")
    .update({ archived_at: new Date().toISOString(), is_active: false })
    .eq("id", id);

  if (error) return serverError("حذف کار خانه ناموفق بود.");

  return NextResponse.json({ ok: true });
}
