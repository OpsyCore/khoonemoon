import { NextResponse } from "next/server";
import {
  buildReminderTimes,
  calculateUpcomingReminders,
} from "@/features/reminders/calculations";
import {
  createRemindersSchema,
  type CreateRemindersInput,
} from "@/features/reminders/schemas";
import type { ReminderRecord } from "@/features/reminders/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function getTargetHouseholdId({
  supabase,
  targetType,
  targetId,
}: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  targetType: "TASK" | "EVENT";
  targetId: string;
}) {
  if (targetType === "TASK") {
    const { data, error } = await supabase
      .from("tasks")
      .select("id, household_id")
      .eq("id", targetId)
      .single();

    if (error || !data) return null;
    return data.household_id;
  }

  const { data, error } = await supabase
    .from("events")
    .select("id, household_id")
    .eq("id", targetId)
    .single();

  if (error || !data) return null;
  return data.household_id;
}

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const horizonHoursParam = Number(
    url.searchParams.get("horizonHours") ?? "72",
  );
  const horizonHours = Number.isFinite(horizonHoursParam)
    ? Math.min(Math.max(horizonHoursParam, 1), 24 * 30)
    : 72;

  const { data, error } = await supabase
    .from("reminders")
    .select(
      "id, target_type, target_id, user_id, household_id, remind_at, status, snoozed_until, snooze_count, delivered_at, created_at, updated_at",
    )
    .eq("user_id", user.id)
    .in("status", ["PENDING", "SNOOZED"])
    .order("remind_at", { ascending: true });

  if (error) {
    return NextResponse.json(
      { message: "دریافت یادآورها ناموفق بود." },
      { status: 500 },
    );
  }

  const upcoming = calculateUpcomingReminders({
    reminders: (data ?? []) as ReminderRecord[],
    now: new Date(),
    horizonHours,
  });

  return NextResponse.json({ reminders: data ?? [], upcoming });
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as CreateRemindersInput;
  const parsed = createRemindersSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Validation failed", errors: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const householdId = await getTargetHouseholdId({
    supabase,
    targetType: parsed.data.targetType,
    targetId: parsed.data.targetId,
  });

  if (householdId === null && parsed.data.targetType === "EVENT") {
    const { data: eventExists } = await supabase
      .from("events")
      .select("id")
      .eq("id", parsed.data.targetId)
      .maybeSingle();
    if (!eventExists) {
      return NextResponse.json(
        { message: "دسترسی به رویداد هدف ممکن نیست." },
        { status: 403 },
      );
    }
  }

  if (householdId === null && parsed.data.targetType === "TASK") {
    const { data: taskExists } = await supabase
      .from("tasks")
      .select("id")
      .eq("id", parsed.data.targetId)
      .maybeSingle();
    if (!taskExists) {
      return NextResponse.json(
        { message: "دسترسی به تسک هدف ممکن نیست." },
        { status: 403 },
      );
    }
  }

  const times = buildReminderTimes({
    baseDateTime: parsed.data.baseDateTime,
    offsetsMinutes: parsed.data.offsets.map((item) => item.minutesBefore),
  });

  const rows = times.map((time) => ({
    target_type: parsed.data.targetType,
    target_id: parsed.data.targetId,
    user_id: user.id,
    household_id: householdId,
    remind_at: time,
    status: "PENDING" as const,
  }));

  const { data, error } = await supabase
    .from("reminders")
    .insert(rows)
    .select(
      "id, target_type, target_id, user_id, household_id, remind_at, status, snoozed_until, snooze_count, delivered_at, created_at, updated_at",
    );

  if (error) {
    return NextResponse.json(
      { message: "ثبت یادآورها ناموفق بود." },
      { status: 400 },
    );
  }

  return NextResponse.json({ reminders: data ?? [] });
}
