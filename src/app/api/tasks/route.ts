import { NextResponse } from "next/server";
import {
  createTaskSchema,
  type CreateTaskInput,
} from "@/features/tasks/schemas";
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

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { data: membership } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", user.id)
    .is("left_at", null)
    .maybeSingle();

  const [tasksResult, membersResult] = await Promise.all([
    supabase
      .from("tasks")
      .select(
        "id, title, description, creator_id, owner_id, household_id, visibility, status, priority, due_at, completed_at, archived_at, created_at, updated_at, task_assignees(assignee_id), task_recurrences(frequency, interval_days, weekdays)",
      )
      .is("archived_at", null)
      .order("created_at", { ascending: false }),
    membership?.household_id
      ? supabase
          .from("household_members")
          .select("user_id, profiles(full_name)")
          .eq("household_id", membership.household_id)
          .is("left_at", null)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (tasksResult.error) {
    return NextResponse.json(
      { message: "دریافت تسک‌ها ناموفق بود." },
      { status: 500 },
    );
  }

  if (membersResult.error) {
    return NextResponse.json(
      { message: "دریافت اعضای خانه ناموفق بود." },
      { status: 500 },
    );
  }

  const members = (
    (membersResult.data ?? []) as {
      user_id: string;
      profiles: { full_name: string }[] | null;
    }[]
  ).map((item) => ({
    user_id: item.user_id,
    full_name: item.profiles?.[0]?.full_name ?? "کاربر",
  }));

  return NextResponse.json({
    tasks: tasksResult.data ?? [],
    members,
    householdId: membership?.household_id ?? null,
  });
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as CreateTaskInput;
  const parsed = createTaskSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Validation failed", errors: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const prepared = await validateTaskInputForUser({
      userId: user.id,
      input: parsed.data,
    });

    const { data: task, error: insertTaskError } = await supabase
      .from("tasks")
      .insert({
        title: parsed.data.title,
        description: parsed.data.description || null,
        creator_id: user.id,
        owner_id: user.id,
        household_id: prepared.householdId,
        visibility: parsed.data.visibility,
        status: parsed.data.status,
        priority: parsed.data.priority,
        due_at: parsed.data.dueAt ?? null,
      })
      .select("id")
      .single();

    if (insertTaskError || !task) {
      return NextResponse.json(
        { message: "ایجاد تسک ناموفق بود." },
        { status: 400 },
      );
    }

    const assigneeIds = parsed.data.assigneeIds.length
      ? parsed.data.assigneeIds
      : [user.id];

    const { error: assigneesError } = await supabase
      .from("task_assignees")
      .insert(
        assigneeIds.map((assigneeId) => ({
          task_id: task.id,
          assignee_id: assigneeId,
        })),
      );

    if (assigneesError) {
      return NextResponse.json(
        { message: "انتساب تسک ناموفق بود." },
        { status: 400 },
      );
    }

    const recurrenceRow = recurrenceToRow({
      dueAt: parsed.data.dueAt,
      recurrence: parsed.data.recurrence,
    });

    if (recurrenceRow) {
      const { error: recurrenceError } = await supabase
        .from("task_recurrences")
        .insert({ task_id: task.id, ...recurrenceRow });

      if (recurrenceError) {
        return NextResponse.json(
          { message: "ذخیره تنظیم تکرار تسک ناموفق بود." },
          { status: 400 },
        );
      }
    }

    return NextResponse.json({ id: task.id });
  } catch (error) {
    return NextResponse.json({ message: mapTaskError(error) }, { status: 400 });
  }
}
