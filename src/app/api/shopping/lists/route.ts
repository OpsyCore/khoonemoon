import { NextResponse } from "next/server";
import { createShoppingListSchema } from "@/features/shopping/schemas";
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
    .from("shopping_lists")
    .select(`
      id,
      household_id,
      created_by,
      name,
      is_active,
      created_at,
      updated_at,
      shopping_items (
        id,
        list_id,
        created_by,
        name,
        quantity,
        unit,
        note,
        is_checked,
        checked_by,
        checked_at,
        created_at,
        updated_at
      )
    `)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { message: "دریافت لیست‌های خرید ناموفق بود." },
      { status: 500 },
    );
  }

  return NextResponse.json({ lists: data ?? [] });
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

  const parsed = createShoppingListSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "اطلاعات لیست معتبر نیست.", errors: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { data: membership, error: membershipError } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", user.id)
    .is("left_at", null)
    .maybeSingle();

  if (membershipError || !membership?.household_id) {
    return NextResponse.json(
      { message: "برای ساخت لیست باید عضو یک خانه باشید." },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("shopping_lists")
    .insert({
      household_id: membership.household_id,
      created_by: user.id,
      name: parsed.data.name,
    })
    .select("id, name, household_id, is_active, created_at, updated_at")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { message: "ساخت لیست خرید ناموفق بود." },
      { status: 400 },
    );
  }

  return NextResponse.json({ list: data }, { status: 201 });
}
