import { NextResponse } from "next/server";

import {
  updateChoreSchema,
} from "@/features/chores/schemas";

import {
  validateUpdateChoreForUser,
} from "@/features/chores/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";


function mapChoreError(error: unknown) {
  if (!(error instanceof Error)) {
    return "انجام عملیات کار خانه ناموفق بود.";
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

  if (
    error.message.includes("CHORE_NOT_FOUND") ||
    error.message.includes("CHORE_ACCESS_DENIED")
  ) {
    return "کار خانه یافت نشد یا به آن دسترسی ندارید.";
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
    return "روزهای هفته معتبر نیستند.";
  }

  return "انجام عملیات کار خانه ناموفق بود.";
}


export async function GET(
  _request: Request,
  context: {
    params: Promise<{ id: string }>;
  },
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

  const { data: chore, error } = await supabase
    .from("chores")
    .select(
      `
        id,
        household_id,
        created_by,
        default_assignee_id,
        title,
        description,
        is_active,
        start_date,
        created_at,
        updated_at,
        chore_recurrences (
          frequency,
          interval_days,
          weekdays,
          next_occurrence_date
        ),
        chore_rotations (
          user_id,
          position
        )
      `,
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !chore) {
    return NextResponse.json(
      { message: "کار خانه یافت نشد." },
      { status: 404 },
    );
  }

  return NextResponse.json({
    chore,
  });
}


export async function PATCH(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  },
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

  const parsed = updateChoreSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        message: "Validation failed",
        errors: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const { data: existing, error: loadError } =
    await supabase
      .from("chores")
      .select(
        `
          id,
          household_id,
          title,
          description,
          start_date,
          default_assignee_id,
          is_active,
          chore_recurrences (
            frequency,
            interval_days,
            weekdays
          ),
          chore_rotations (
            user_id,
            position
          )
        `,
      )
      .eq("id", id)
      .maybeSingle();

  if (loadError || !existing) {
    return NextResponse.json(
      { message: "کار خانه یافت نشد." },
      { status: 404 },
    );
  }

  const recurrenceRows =
    existing.chore_recurrences ?? [];

  const currentRecurrence =
    recurrenceRows[0];

  if (!currentRecurrence) {
    return NextResponse.json(
      {
        message:
          "تنظیم تکرار فعلی کار خانه یافت نشد.",
      },
      { status: 400 },
    );
  }

  const currentRotationIds = [
    ...(existing.chore_rotations ?? []),
  ]
    .sort(
      (a, b) =>
        a.position - b.position,
    )
    .map(
      (item) => item.user_id,
    );

  const input = parsed.data;

  const title =
    input.title ??
    existing.title;

  const description =
    input.description === undefined
      ? existing.description
      : input.description;

  const startDate =
    input.startDate ??
    existing.start_date;

  const defaultAssigneeId =
    input.defaultAssigneeId === undefined
      ? existing.default_assignee_id
      : input.defaultAssigneeId;

  const isActive =
    input.isActive ??
    existing.is_active;

  const recurrence =
    input.recurrence ?? {
      frequency:
        currentRecurrence.frequency,

      intervalDays:
        currentRecurrence.interval_days,

      weekdays:
        currentRecurrence.weekdays,
    };

  const rotationUserIds =
    input.rotationUserIds ??
    currentRotationIds;

  try {
    await validateUpdateChoreForUser({
      userId: user.id,
      householdId:
        existing.household_id,
      input: {
        title,
        description,
        startDate,
        defaultAssigneeId,
        isActive,
        recurrence,
        rotationUserIds,
      },
    });

    const { data: updated, error } =
      await supabase.rpc(
        "update_chore",
        {
          p_chore_id: id,

          p_title:
            title,

          p_description:
            description ?? null,

          p_start_date:
            startDate,

          p_default_assignee_id:
            defaultAssigneeId ?? null,

          p_frequency:
            recurrence.frequency,

          p_interval_days:
            recurrence.intervalDays ?? null,

          p_weekdays:
            recurrence.weekdays ?? null,

          p_rotation_user_ids:
            rotationUserIds,

          p_is_active:
            isActive,
        },
      );

    if (error || !updated) {
      throw new Error(
        error?.message ??
          "UPDATE_CHORE_FAILED",
      );
    }

    return NextResponse.json({
      ok: true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          mapChoreError(error),
      },
      { status: 400 },
    );
  }
}


export async function DELETE(
  _request: Request,
  context: {
    params: Promise<{ id: string }>;
  },
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
    .select(
      `
        id,
        household_id,
        title,
        description,
        start_date,
        default_assignee_id,
        is_active,
        chore_recurrences (
          frequency,
          interval_days,
          weekdays
        ),
        chore_rotations (
          user_id,
          position
        )
      `,
    )
    .eq("id", id)
    .maybeSingle();

  if (loadError || !existing) {
    return NextResponse.json(
      { message: "کار خانه یافت نشد." },
      { status: 404 },
    );
  }

  if (existing.is_active === false) {
    return NextResponse.json({ ok: true });
  }

  const recurrenceRaw = existing.chore_recurrences;
  const currentRecurrence = Array.isArray(recurrenceRaw)
    ? recurrenceRaw[0]
    : recurrenceRaw;

  if (!currentRecurrence?.frequency) {
    return NextResponse.json(
      { message: "تنظیم تکرار فعلی کار خانه یافت نشد." },
      { status: 400 },
    );
  }

  const rotationRaw = existing.chore_rotations;
  const rotationRows = Array.isArray(rotationRaw)
    ? rotationRaw
    : rotationRaw
      ? [rotationRaw]
      : [];

  const rotationUserIds = [...rotationRows]
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((item) => item.user_id)
    .filter(Boolean);

  // Prefer full update first (keeps title/recurrence). If member validation
  // blocks, retry with cleared assignee/rotation so soft-delete still works.
  async function callUpdate(payload: {
    p_chore_id: string;
    p_title: string;
    p_description: string | null;
    p_start_date: string;
    p_default_assignee_id: string | null;
    p_frequency: string;
    p_interval_days: number | null;
    p_weekdays: number[] | null;
    p_rotation_user_ids: string[];
    p_is_active: boolean;
  }) {
    return supabase.rpc("update_chore", payload);
  }

  const base = {
    p_chore_id: id,
    p_title: existing.title,
    p_description: existing.description ?? null,
    p_start_date: existing.start_date,
    p_frequency: currentRecurrence.frequency,
    p_interval_days: currentRecurrence.interval_days ?? null,
    p_weekdays: currentRecurrence.weekdays ?? null,
    p_is_active: false,
  };

  let result = await callUpdate({
    ...base,
    p_default_assignee_id: existing.default_assignee_id ?? null,
    p_rotation_user_ids: rotationUserIds,
  });

  if (result.error) {
    result = await callUpdate({
      ...base,
      p_default_assignee_id: null,
      p_rotation_user_ids: [],
    });
  }

  if (result.error) {
    const raw = result.error.message || "";
    return NextResponse.json(
      {
        message: raw
          ? `حذف کار خانه ناموفق بود: ${raw}`
          : "حذف کار خانه ناموفق بود.",
      },
      { status: 400 },
    );
  }

  // update_chore returns boolean; only explicit false is failure.
  if (result.data === false) {
    return NextResponse.json(
      { message: "حذف کار خانه ناموفق بود." },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true });
}
