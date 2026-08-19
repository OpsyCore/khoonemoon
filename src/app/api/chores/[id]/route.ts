import { NextResponse } from "next/server";
import {
  updateChoreSchema,
  type UpdateChoreInput,
} from "@/features/chores/schemas";
import { validateUpdateChoreForUser } from "@/features/chores/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function mapChoreError(error: unknown) {
  if (!(error instanceof Error)) {
    return "انجام عملیات کار خانه ناموفق بود.";
  }

  if (error.message.includes("NO_HOUSEHOLD_FOR_CHORE")) {
    return "برای ساخت کار خانه باید عضو یک خانه باشید.";
  }

  if (error.message.includes("INVALID_DEFAULT_ASSIGNEE")) {
    return "مسئول پیش‌فرض انتخاب‌شده معتبر نیست.";
  }

  if (error.message.includes("INVALID_ROTATION_MEMBER")) {
    return "یکی از اعضای چرخش معتبر نیست.";
  }

  if (error.message.includes("DUPLICATE_ROTATION_MEMBER")) {
    return "اعضای چرخش نباید تکراری باشند.";
  }

  if (error.message.includes("CHORE_NOT_FOUND")) {
    return "کار خانه یافت نشد.";
  }

  if (error.message.includes("CHORE_ACCESS_DENIED")) {
    return "دسترسی به این کار خانه مجاز نیست.";
  }

  if (error.message.includes("INVALID_CHORE_TITLE")) {
    return "عنوان کار خانه نمی‌تواند خالی باشد.";
  }

  if (error.message.includes("INVALID_START_DATE")) {
    return "تاریخ شروع معتبر نیست.";
  }

  if (error.message.includes("INVALID_INTERVAL_DAYS")) {
    return "فاصله روزها باید مثبت باشد.";
  }

  if (error.message.includes("WEEKDAYS_REQUIRED")) {
    return "حداقل یک روز هفته انتخاب کنید.";
  }

  if (error.message.includes("INVALID_WEEKDAYS")) {
    return "روزهای هفته باید بین  تا ۶ باشند.";
  }

  return "انجام عملیات کار خانه ناموفق بود.";
}

export async function GET(
  _request: Request,
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

  const { data, error } = await supabase
    .from("chores")
    .select(
      [
        "id",
        "household_id",
        "created_by",
        "default_assignee_id",
        "title",
        "description",
        "is_active",
        "start_date",
        "created_at",
        "updated_at",
        "chore_recurrences(frequency, interval_days, weekdays, next_occurrence_date)",
        "chore_rotations(user_id, position)",
      ].join(", "),
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      { message: "کار خانه یافت نشد." },
      { status: 404 },
    );
  }

  return NextResponse.json({
    chore: data,
  });
}

export async function PATCH(
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

  const parsed = updateChoreSchema.safeParse(
    body as UpdateChoreInput,
  );

  if (!parsed.success) {
    return NextResponse.json(
      {
        message: "Validation failed",
        errors: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  try {
    const input = parsed.data;

    await validateUpdateChoreForUser({
      userId: user.id,
      householdId: input.householdId!,
      input,
    });

    const recurrence = input.recurrence;
    const rotationUserIds = input.rotationUserIds ?? [];

    const { data: result, error } = await supabase.rpc(
      "update_chore",
      {
        p_chore_id: id,
        p_title: input.title ?? undefined,
        p_description: input.description ?? null,
        p_start_date: input.startDate ?? undefined,
        p_default_assignee_id:
          input.defaultAssigneeId ?? null,
        p_frequency: recurrence?.frequency ?? undefined,
        p_interval_days: recurrence?.intervalDays ?? null,
        p_weekdays: recurrence?.weekdays ?? null,
        p_rotation_user_ids: rotationUserIds,
        p_is_active: input.isActive ?? undefined,
      },
    );

    if (error || !result) {
      throw new Error(error?.message ?? "UPDATE_CHORE_FAILED");
    }

    return NextResponse.json({
      ok: true,
    });
  } catch (error) {
    return NextResponse.json(
      { message: mapChoreError(error) },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _request: Request,
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

  const { data: existing, error: loadError } = await supabase
    .from("chores")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (loadError || !existing) {
    return NextResponse.json(
      { message: "کار خانه یافت نشد." },
      { status: 404 },
    );
  }

  const { error } = await supabase
    .from("chores")
    .update({
      is_active: false,
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json(
      { message: "غیرفعال کردن کار خانه ناموفق بود." },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
  });
}
