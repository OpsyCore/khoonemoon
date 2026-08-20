import { NextResponse } from "next/server";
import { profileSchema } from "@/features/profile/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, timezone, locale, created_at, updated_at")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { message: `Failed to load profile: ${error.message}` },
      { status: 500 },
    );
  }

  if (!data) {
    return NextResponse.json({ message: "Profile not found" }, { status: 404 });
  }

  return NextResponse.json({ profile: data });
}

export async function PATCH(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
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

  const parsed = profileSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        message: "Validation failed",
        errors: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const { error } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      ...parsed.data,
    },
    { onConflict: "id" },
  );

  if (error) {
    return NextResponse.json(
      { message: `Failed to update profile: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
