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

  // Query lists and items separately. This avoids relying on
  // PostgREST relation embedding/schema-cache for shopping_items.
  const { data: lists, error: listsError } = await supabase
    .from("shopping_lists")
    .select(
      "id, household_id, created_by, name, is_active, created_at, updated_at",
    )
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (listsError) {
    return NextResponse.json(
      {
        message: "دریافت لیست‌های خرید ناموفق بود.",
        detail: listsError.message,
      },
      { status: 500 },
    );
  }

  if (!lists?.length) {
    return NextResponse.json({ lists: [] });
  }

  const listIds = lists.map((list) => list.id);

  const { data: items, error: itemsError } = await supabase
    .from("shopping_items")
    .select(
      "id, list_id, created_by, name, quantity, unit, note, is_checked, checked_by, checked_at, created_at, updated_at",
    )
    .in("list_id", listIds)
    .order("created_at", { ascending: false });

  if (itemsError) {
    return NextResponse.json(
      {
        message: "دریافت کالاهای لیست خرید ناموفق بود.",
        detail: itemsError.message,
      },
      { status: 500 },
    );
  }

  const itemsByList = new Map<string, typeof items>();

  for (const item of items ?? []) {
    const current = itemsByList.get(item.list_id) ?? [];
    current.push(item);
    itemsByList.set(item.list_id, current);
  }

  return NextResponse.json({
    lists: lists.map((list) => ({
      ...list,
      shopping_items: itemsByList.get(list.id) ?? [],
    })),
  });
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
