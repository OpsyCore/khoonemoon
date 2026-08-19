import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
        "chore_completions(id, for_date, assigned_to, completed_by, completed_at)",
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

  /*
   * MVP uses deactivation instead of destructive hard delete.
   * Historical completions remain available.
   */
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
