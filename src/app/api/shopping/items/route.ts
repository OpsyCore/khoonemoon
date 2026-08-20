import { NextResponse } from "next/server";
import { createShoppingItemSchema } from "@/features/shopping/schemas";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

  const parsed = createShoppingItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "اطلاعات کالا معتبر نیست.", errors: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Select first: RLS guarantees the current user can only see
  // a list belonging to their own household.
  const { data: list, error: listError } = await supabase
    .from("shopping_lists")
    .select("id, is_active")
    .eq("id", parsed.data.listId)
    .maybeSingle();

  if (listError || !list || !list.is_active) {
    return NextResponse.json(
      { message: "لیست خرید یافت نشد یا غیرفعال است." },
      { status: 404 },
    );
  }

  const { data, error } = await supabase
    .from("shopping_items")
    .insert({
      list_id: parsed.data.listId,
      created_by: user.id,
      name: parsed.data.name,
      quantity: parsed.data.quantity ?? null,
      unit: parsed.data.unit ?? null,
      note: parsed.data.note ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { message: "افزودن کالا ناموفق بود." },
      { status: 400 },
    );
  }

  return NextResponse.json({ id: data.id }, { status: 201 });
}
