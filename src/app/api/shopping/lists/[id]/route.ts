import { NextResponse } from "next/server";
import { updateShoppingListSchema } from "@/features/shopping/schemas";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
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

  const parsed = updateShoppingListSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "اطلاعات لیست معتبر نیست.", errors: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const update: { name?: string; is_active?: boolean } = {};
  if (parsed.data.name !== undefined) update.name = parsed.data.name;
  if (parsed.data.isActive !== undefined) {
    update.is_active = parsed.data.isActive;
  }

  const { data, error } = await supabase
    .from("shopping_lists")
    .update(update)
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      { message: "ویرایش لیست خرید ناموفق بود." },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true });
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
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  // Soft delete: items/history stay intact.
  const { data, error } = await supabase
    .from("shopping_lists")
    .update({ is_active: false })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      { message: "حذف لیست خرید ناموفق بود." },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true });
}
