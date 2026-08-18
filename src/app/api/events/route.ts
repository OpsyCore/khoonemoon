import { NextResponse } from "next/server";
import {
  createEventSchema,
  type CreateEventInput,
} from "@/features/calendar/schemas";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function mapEventError(error: unknown) {
  if (error instanceof Error) {
    if (error.message.includes("NO_HOUSEHOLD")) {
      return "برای ایجاد رویداد اشتراکی باید عضو یک خانه باشید.";
    }
  }
  return "انجام عملیات رویداد ناموفق بود.";
}

export async function GET() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("events")
    .select(
      "id, title, description, creator_id, owner_id, household_id, visibility, start_at, end_at, all_day, location, created_at, updated_at",
    )
    .order("start_at", { ascending: true });

  if (error) {
    return NextResponse.json(
      { message: "دریافت رویدادها ناموفق بود." },
      { status: 500 },
    );
  }

  return NextResponse.json({ events: data ?? [] });
}

export async function POST(request: Request) {
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

  try {
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
      throw new Error("NO_HOUSEHOLD");
    }

    const { data, error } = await supabase
      .from("events")
      .insert({
        title: parsed.data.title,
        description: parsed.data.description || null,
        creator_id: user.id,
        owner_id: user.id,
        household_id: householdId,
        visibility: parsed.data.visibility,
        start_at: parsed.data.startAt,
        end_at: parsed.data.endAt,
        all_day: parsed.data.allDay,
        location: parsed.data.location || null,
      })
      .select("id")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { message: "ایجاد رویداد ناموفق بود." },
        { status: 400 },
      );
    }

    return NextResponse.json({ id: data.id });
  } catch (error) {
    return NextResponse.json(
      { message: mapEventError(error) },
      { status: 400 },
    );
  }
}
