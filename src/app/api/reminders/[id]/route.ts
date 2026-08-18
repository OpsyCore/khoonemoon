import { NextResponse } from "next/server";
import { applySnooze } from "@/features/reminders/calculations";
import {
  snoozeReminderSchema,
  type SnoozeReminderInput,
} from "@/features/reminders/schemas";
import type { ReminderRecord } from "@/features/reminders/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function PATCH(
  request: Request,
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

  const body = (await request.json()) as
    (SnoozeReminderInput & { action: "snooze" }) | { action: "cancel" };

  if (body.action === "cancel") {
    const { error } = await supabase
      .from("reminders")
      .update({ status: "CANCELED" })
      .eq("id", params.id)
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json(
        { message: "لغو یادآور ناموفق بود." },
        { status: 400 },
      );
    }

    return NextResponse.json({ ok: true });
  }

  const parsed = snoozeReminderSchema.safeParse({
    reminderId: params.id,
    minutes: body.minutes,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Validation failed", errors: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { data: reminder, error: reminderError } = await supabase
    .from("reminders")
    .select(
      "id, target_type, target_id, user_id, household_id, remind_at, status, snoozed_until, snooze_count, delivered_at, created_at, updated_at",
    )
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single();

  if (reminderError || !reminder) {
    return NextResponse.json({ message: "یادآور یافت نشد." }, { status: 404 });
  }

  const snoozed = applySnooze({
    reminder: reminder as ReminderRecord,
    minutes: parsed.data.minutes,
    now: new Date(),
  });

  const { error } = await supabase
    .from("reminders")
    .update(snoozed)
    .eq("id", params.id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json(
      { message: "تعویق یادآور ناموفق بود." },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true });
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

  const { error } = await supabase
    .from("reminders")
    .delete()
    .eq("id", params.id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json(
      { message: "حذف یادآور ناموفق بود." },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true });
}
