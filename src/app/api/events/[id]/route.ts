import { NextResponse } from "next/server";
import {
  createEventSchema,
  type CreateEventInput,
} from "@/features/calendar/schemas";
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

  const body = (await request.json()) as CreateEventInput;
  const parsed = createEventSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Validation failed", errors: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { data: membership } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", user.id)
    .is("left_at", null)
    .maybeSingle();

  const householdId =
    parsed.data.visibility === "HOUSEHOLD_SHARED"
      ? (membership?.household_id ?? null)
      : null;

  if (parsed.data.visibility === "HOUSEHOLD_SHARED" && !householdId) {
    return NextResponse.json(
      { message: "برای رویداد اشتراکی باید عضو خانه باشید." },
      { status: 400 },
    );
  }

  const { error } = await supabase
    .from("events")
    .update({
      title: parsed.data.title,
      description: parsed.data.description || null,
      household_id: householdId,
      visibility: parsed.data.visibility,
      start_at: parsed.data.startAt,
      end_at: parsed.data.endAt,
      all_day: parsed.data.allDay,
      location: parsed.data.location || null,
    })
    .eq("id", params.id);

  if (error) {
    return NextResponse.json(
      { message: "ویرایش رویداد ناموفق بود." },
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

  const { error } = await supabase.from("events").delete().eq("id", params.id);

  if (error) {
    return NextResponse.json(
      { message: "حذف رویداد ناموفق بود." },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true });
}
