import { NextResponse } from "next/server";
import {
  reminderPreferencesSchema,
  type ReminderPreferencesInput,
} from "@/features/reminders/schemas";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("notification_preferences")
    .select(
      "id, user_id, in_app_enabled, web_push_enabled, quiet_hours_enabled, quiet_hours_start, quiet_hours_end, created_at, updated_at",
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { message: "دریافت تنظیمات اعلان ناموفق بود." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    preferences:
      data ??
      ({
        id: "",
        user_id: user.id,
        in_app_enabled: true,
        web_push_enabled: false,
        quiet_hours_enabled: false,
        quiet_hours_start: null,
        quiet_hours_end: null,
        created_at: "",
        updated_at: "",
      } as const),
  });
}

export async function PUT(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as ReminderPreferencesInput;
  const parsed = reminderPreferencesSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Validation failed", errors: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { error } = await supabase.from("notification_preferences").upsert(
    {
      user_id: user.id,
      in_app_enabled: parsed.data.inAppEnabled,
      web_push_enabled: parsed.data.webPushEnabled,
      quiet_hours_enabled: parsed.data.quietHoursEnabled,
      quiet_hours_start: parsed.data.quietHoursStart ?? null,
      quiet_hours_end: parsed.data.quietHoursEnd ?? null,
    },
    { onConflict: "user_id" },
  );

  if (error) {
    return NextResponse.json(
      { message: "ذخیره تنظیمات اعلان ناموفق بود." },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true });
}
