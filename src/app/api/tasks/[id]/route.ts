import { NextResponse } from "next/server";
import {
  patchTaskSchema,
  type CreateTaskInput,
} from "@/features/tasks/schemas";
import { applyTaskCompletion } from "@/features/tasks/security";
import {
  recurrenceToRow,
  validateTaskInputForUser,
} from "@/features/tasks/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function mapTaskError(error: unknown) {
  if (error instanceof Error) {
    if (error.message.includes("NO_HOUSEHOLD_FOR_SHARED_TASK")) {
      return "برای ساخت تسک اشتراکی باید عضو یک خانه باشید.";
    }

    if (error.message.includes("INVALID_TASK_ASSIGNMENT")) {
      return "انتساب تسک معتبر نیست.";
    }
  }

  return "انجام عملیات تسک ناموفق بود.";
}

async function getAccessibleTask(taskId: string) {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("tasks")
    .select("id, status")
    .eq("id", taskId)
    .single();

  if (error || !data) {
    return null;
  }

  return data;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const params = await context.params;
  const taskId = params.id;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const existing = await getAccessibleTask(taskId);
  if (!existing) {
    return NextResponse.json({ message: "تسک یافت نشد." }, { status: 404 });
  }

  const body = await request.json();
  const parsed = patchTaskSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Validation failed", errors: parsed.error.flatten() },
      { status: 400 },
    );
  }

  if (parsed.data.action === "complete" || parsed.data.action === "undo") {
    const completion = applyTaskCompletion({
      currentStatus: existing.status,
      action: parsed.data.action,
    });

    const { error } = await supabase
      .from("tasks")
      .update({
        status: completion.status,
        completed_at: completion.completedAt,
      })
      .eq("id", taskId);

    if (error) {
      return NextResponse.json(
        { message: "تغییر وضعیت تسک ناموفق بود." },
        { status: 400 },
      );
    }

    return NextResponse.json({ ok: true });
  }

  if (parsed.data.action === "archive") {
    const { error } = await supabase
      .from("tasks")
      .update({
        status: "ARCHIVED",
        archived_at: new Date().toISOString(),
      })
      .eq("id", taskId);

    if (error) {
      return NextResponse.json(
        { message: "آرشیو تسک ناموفق بود." },
        { status: 400 },
      );
    }

    return NextResponse.json({ ok: true });
  }

  if (parsed.data.action === "reschedule") {
    const { error } = await supabase
      .from("tasks")
      .update({ due_at: parsed.data.dueAt })
      .eq("id", taskId);

    if (error) {
      return NextResponse.json(
        { message: "زمان‌بندی مجدد تسک ناموفق بود." },
        { status: 400 },
      );
    }

    return NextResponse.json({ ok: true });
  }

  try {
    const input = parsed.data.data as CreateTaskInput;
    const prepared = await validateTaskInputForUser({
      userId: user.id,
      input,
    });

    const { error: updateTaskError } = await supabase
      .from("tasks")
      .update({
        title: input.title,
        description: input.description || null,
        household_id: prepared.householdId,
        visibility: input.visibility,
        status: input.status,
        priority: input.priority,
        due_at: input.dueAt ?? null,
      })
      .eq("id", taskId);

    if (updateTaskError) {
      return NextResponse.json(
        { message: "ویرایش تسک ناموفق بود." },
        { status: 400 },
      );
    }

    await supabase.from("task_assignees").delete().eq("task_id", taskId);

    const assigneeIds = input.assigneeIds.length
      ? input.assigneeIds
      : [user.id];
    const { error: assigneeError } = await supabase
      .from("task_assignees")
      .insert(
        assigneeIds.map((assigneeId) => ({
          task_id: taskId,
          assignee_id: assigneeId,
        })),
      );

    if (assigneeError) {
      return NextResponse.json(
        { message: "ذخیره مسئولین تسک ناموفق بود." },
        { status: 400 },
      );
    }

    const recurrenceRow = recurrenceToRow({
      dueAt: input.dueAt,
      recurrence: input.recurrence,
    });

    if (!recurrenceRow) {
      await supabase.from("task_recurrences").delete().eq("task_id", taskId);
    } else {
      await supabase.from("task_recurrences").upsert(
        {
          task_id: taskId,
          ...recurrenceRow,
        },
        { onConflict: "task_id" },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ message: mapTaskError(error) }, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const params = await context.params;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabase.from("tasks").delete().eq("id", params.id);

  if (error) {
    return NextResponse.json(
      { message: "حذف تسک ناموفق بود." },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true });
}
