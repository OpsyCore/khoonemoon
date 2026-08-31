import { NextResponse } from "next/server";
import { updateShoppingItemSchema } from "@/features/shopping/schemas";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ShoppingItemUpdate = {
  name?: string;
  quantity?: number | null;
  unit?: string | null;
  note?: string | null;
  is_checked?: boolean;
  checked_by?: string | null;
  checked_at?: string | null;
};

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

  const parsed = updateShoppingItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "اطلاعات کالا معتبر نیست.", errors: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const update: ShoppingItemUpdate = {};

  if (parsed.data.name !== undefined) update.name = parsed.data.name;
  if (parsed.data.quantity !== undefined) {
    update.quantity = parsed.data.quantity;
  }
  if (parsed.data.unit !== undefined) update.unit = parsed.data.unit;
  if (parsed.data.note !== undefined) update.note = parsed.data.note;

  if (parsed.data.isChecked !== undefined) {
    update.is_checked = parsed.data.isChecked;
    update.checked_by = parsed.data.isChecked ? user.id : null;
    update.checked_at = parsed.data.isChecked ? new Date().toISOString() : null;
  }

  const { data, error } = await supabase
    .from("shopping_items")
    .update(update)
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      { message: "ویرایش کالا ناموفق بود." },
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

  const { data, error } = await supabase
    .from("shopping_items")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      { message: "حذف کالا ناموفق بود." },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true });
}
