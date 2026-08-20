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

  return error.message || "انجام عملیات کار خانه ناموفق بود.";
}

export async function GET() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
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

    const householdId = membership.household_id;

    // 1) Base rows WITHOUT embed (embed can fail RLS/relationship and empty the list)
    const choresResult = await supabase
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
        ].join(", "),
      )
      .eq("household_id", householdId)
      .or("is_active.eq.true,is_active.is.null")
      .order("created_at", { ascending: false });

    if (choresResult.error) {
      return NextResponse.json(
        {
          message: `دریافت کارهای خانه ناموفق بود: ${choresResult.error.message}`,
        },
        { status: 500 },
      );
    }

    const choreRows = (choresResult.data ?? []).filter(
      (row) => row.is_active !== false,
    );
    const choreIds = choreRows.map((row) => row.id);

    // 2) Nested data separately
    const recurrencesByChore = new Map<
      string,
      {
        frequency: string;
        interval_days: number | null;
        weekdays: number[] | null;
      }
    >();
    const rotationsByChore = new Map<
      string,
      Array<{ user_id: string; position: number }>
    >();

    if (choreIds.length > 0) {
      const [recResult, rotResult] = await Promise.all([
        supabase
          .from("chore_recurrences")
          .select("chore_id, frequency, interval_days, weekdays")
          .in("chore_id", choreIds),
        supabase
          .from("chore_rotations")
          .select("chore_id, user_id, position")
          .in("chore_id", choreIds)
          .order("position", { ascending: true }),
      ]);

      if (!recResult.error) {
        for (const row of recResult.data ?? []) {
          recurrencesByChore.set(row.chore_id, {
            frequency: row.frequency,
            interval_days: row.interval_days,
            weekdays: row.weekdays,
          });
        }
      }

      if (!rotResult.error) {
        for (const row of rotResult.data ?? []) {
          const list = rotationsByChore.get(row.chore_id) ?? [];
          list.push({ user_id: row.user_id, position: row.position });
          rotationsByChore.set(row.chore_id, list);
        }
      }
    }

    const chores = choreRows.map((row) => {
      const rec = recurrencesByChore.get(row.id);
      return {
        ...row,
        is_active: row.is_active ?? true,
        chore_recurrences: rec
          ? [
              {
                frequency: rec.frequency,
                interval_days: rec.interval_days,
                weekdays: rec.weekdays,
              },
            ]
          : [],
        chore_rotations: rotationsByChore.get(row.id) ?? [],
      };
    });

    const membersResult = await supabase
      .from("household_members")
      .select("user_id")
      .eq("household_id", householdId)
      .is("left_at", null);

    if (membersResult.error) {
      return NextResponse.json(
        {
          message: `دریافت اعضای خانه ناموفق بود: ${membersResult.error.message}`,
        },
        { status: 500 },
      );
    }

    const memberRows = membersResult.data ?? [];
    const userIds = memberRows.map((row) => row.user_id);

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
      for (const profile of profilesResult.data ?? []) {
        nameById.set(profile.id, profile.full_name || "کاربر");
      }
    }

    const members = memberRows.map((row) => ({
      user_id: row.user_id,
      full_name: nameById.get(row.user_id) ?? "کاربر",
    }));

    return NextResponse.json({
      chores,
      members,
      householdId,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "دریافت کارهای خانه ناموفق بود.",
      },
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
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
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

  const parsed = createChoreSchema.safeParse(body as CreateChoreInput);

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

    const { data: choreId, error } = await supabase.rpc("create_chore", {
      p_title: parsed.data.title,
      p_description: parsed.data.description ?? null,
      p_start_date: parsed.data.startDate,
      p_default_assignee_id: parsed.data.defaultAssigneeId ?? null,
      p_frequency: parsed.data.recurrence.frequency,
      p_interval_days: parsed.data.recurrence.intervalDays ?? null,
      p_weekdays: parsed.data.recurrence.weekdays ?? null,
      p_rotation_user_ids: parsed.data.rotationUserIds ?? [],
    });

    if (error || !choreId) {
      throw new Error(error?.message ?? "CREATE_CHORE_FAILED");
    }

    // Ensure row is active even if DB default/RPC omitted is_active
    await supabase
      .from("chores")
      .update({ is_active: true })
      .eq("id", choreId);

    return NextResponse.json({ id: choreId }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: mapChoreError(error) },
      { status: 400 },
    );
  }
}
