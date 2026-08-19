import { NextResponse } from "next/server";
import { completeChoreSchema } from "@/features/chores/schemas";
import { resolveChoreAssignment } from "@/features/chores/server";
import type {
  ChoreRecurrence,
  ChoreRotationMember,
} from "@/features/chores/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function mapCompletionError(message: string) {
  if (message.includes("CHORE_ALREADY_COMPLETED")) {
    return {
      message: "این نوبت قبلاً انجام شده است.",
      status: 409,
    };
  }

  if (
    message.includes("CHORE_NOT_FOUND") ||
    message.includes("CHORE_ACCESS_DENIED")
  ) {
    return {
      message: "کار خانه یافت نشد.",
      status: 404,
    };
  }

  if (message.includes("CHORE_INACTIVE")) {
    return {
      message: "این کار خانه غیرفعال است.",
      status: 400,
    };
  }

  return {
    message: "ثبت انجام کار خانه ناموفق بود.",
    status: 400,
  };
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { message: "Unauthorized" },
      { status: 401 },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { message: "درخواست JSON معتبر نیست." },
      { status: 400 },
    );
  }

  const parsed = completeChoreSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        message: "Validation failed",
        errors: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const { data: chore, error: choreError } =
    await supabase
      .from("chores")
      .select(
        "id, start_date, default_assignee_id, is_active",
      )
      .eq("id", id)
      .maybeSingle();

  if (choreError || !chore) {
    return NextResponse.json(
      { message: "کار خانه یافت نشد." },
      { status: 404 },
    );
  }

  if (!chore.is_active) {
    return NextResponse.json(
      { message: "این کار خانه غیرفعال است." },
      { status: 400 },
    );
  }

  const { data: recurrenceRow, error: recurrenceError } =
    await supabase
      .from("chore_recurrences")
      .select("frequency, interval_days, weekdays")
      .eq("chore_id", id)
      .maybeSingle();

  if (recurrenceError || !recurrenceRow) {
    return NextResponse.json(
      { message: "تنظیم تکرار کار خانه یافت نشد." },
      { status: 400 },
    );
  }

  const { data: rotationRows, error: rotationError } =
    await supabase
      .from("chore_rotations")
      .select("user_id, position")
      .eq("chore_id", id)
      .order("position", { ascending: true });

  if (rotationError) {
    return NextResponse.json(
      { message: "دریافت چرخش مسئولیت ناموفق بود." },
      { status: 400 },
    );
  }

  const recurrence: ChoreRecurrence = {
    frequency: recurrenceRow.frequency,
    intervalDays: recurrenceRow.interval_days,
    weekdays: recurrenceRow.weekdays,
  };

  const rotation: ChoreRotationMember[] = (
    rotationRows ?? []
  ).map((row) => ({
    userId: row.user_id,
    position: row.position,
  }));

  let assignedTo: string | null;

  try {
    assignedTo = resolveChoreAssignment({
      startDate: chore.start_date,
      forDate: parsed.data.forDate,
      recurrence,
      rotation,
      defaultAssigneeId:
        chore.default_assignee_id ?? null,
    }).assignedTo;
  } catch {
    return NextResponse.json(
      {
        message:
          "این تاریخ جزو برنامه این کار خانه نیست.",
      },
      { status: 400 },
    );
  }

  const { data: completionId, error } =
    await supabase.rpc("complete_chore", {
      p_chore_id: id,
      p_for_date: parsed.data.forDate,
      p_assigned_to: assignedTo,
    });

  if (error || !completionId) {
    const mapped = mapCompletionError(
      error?.message ?? "COMPLETE_CHORE_FAILED",
    );

    return NextResponse.json(
      { message: mapped.message },
      { status: mapped.status },
    );
  }

  return NextResponse.json(
    {
      completion: {
        id: completionId,
        choreId: id,
        forDate: parsed.data.forDate,
        assignedTo,
        completedBy: user.id,
      },
    },
    { status: 201 },
  );
}
