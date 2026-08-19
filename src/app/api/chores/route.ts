import { NextResponse } from "next/server";
import {
  createChoreSchema,
  type CreateChoreInput,
} from "@/features/chores/schemas";
import {
  getCurrentChoreMembership,
  validateCreateChoreForUser,
} from "@/features/chores/server";
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

  return "انجام عملیات کار خانه ناموفق بود.";
}

export async function GET() {
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

  try {
    const membership = await getCurrentChoreMembership(user.id);

    if (!membership?.household_id) {
      return NextResponse.json({
        chores: [],
        members: [],
        householdId: null,
      });
    }

    const [choresResult, membersResult] = await Promise.all([
      supabase
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
        .eq("household_id", membership.household_id)
        .eq("is_active", true)
        .order("created_at", { ascending: false }),

      supabase
        .from("household_members")
        .select("user_id, profiles(full_name)")
        .eq("household_id", membership.household_id)
        .is("left_at", null),
    ]);

    if (choresResult.error) {
      return NextResponse.json(
        { message: "دریافت کارهای خانه ناموفق بود." },
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
      chores: choresResult.data ?? [],
      members,
      householdId: membership.household_id,
    });
  } catch {
    return NextResponse.json(
      { message: "دریافت کارهای خانه ناموفق بود." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
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

  const parsed = createChoreSchema.safeParse(
    body as CreateChoreInput,
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
    await validateCreateChoreForUser({
      userId: user.id,
      input: parsed.data,
    });

    const { data: choreId, error } = await supabase.rpc(
      "create_chore",
      {
        p_title: parsed.data.title,
        p_description: parsed.data.description ?? null,
        p_start_date: parsed.data.startDate,
        p_default_assignee_id:
          parsed.data.defaultAssigneeId ?? null,
        p_frequency: parsed.data.recurrence.frequency,
        p_interval_days:
          parsed.data.recurrence.intervalDays ?? null,
        p_weekdays:
          parsed.data.recurrence.weekdays ?? null,
        p_rotation_user_ids:
          parsed.data.rotationUserIds,
      },
    );

    if (error || !choreId) {
      throw new Error(
        error?.message ?? "CREATE_CHORE_FAILED",
      );
    }

    return NextResponse.json(
      { id: choreId },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      { message: mapChoreError(error) },
      { status: 400 },
    );
  }
}
