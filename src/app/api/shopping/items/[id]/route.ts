import { NextResponse } from "next/server";
import { updateShoppingItemSchema } from "@/features/shopping/schemas";
import {
  getSessionContext,
  serverError,
  validationError,
} from "@/lib/api/session";

const ITEM_SELECT =
  "id, list_id, name, quantity, unit, category, note, added_by, purchased, purchased_by, purchased_at, position, created_at, updated_at";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const session = await getSessionContext();
  if (!session.ok) return session.response;

  const { supabase, userId } = session.context;

  const parsed = updateShoppingItemSchema.safeParse(await request.json());
  if (!parsed.success) return validationError(parsed.error);

  const patch: Record<string, unknown> = {};

  if (parsed.data.name !== undefined) patch.name = parsed.data.name;
  if (parsed.data.quantity !== undefined) patch.quantity = parsed.data.quantity;
  if (parsed.data.unit !== undefined) patch.unit = parsed.data.unit;
  if (parsed.data.category !== undefined) patch.category = parsed.data.category;
  if (parsed.data.note !== undefined) patch.note = parsed.data.note;

  if (parsed.data.purchased !== undefined) {
    patch.purchased = parsed.data.purchased;
    patch.purchased_by = parsed.data.purchased ? userId : null;
    patch.purchased_at = parsed.data.purchased
      ? new Date().toISOString()
      : null;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ message: "تغییری ارسال نشد." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("shopping_items")
    .update(patch)
    .eq("id", id)
    .select(ITEM_SELECT)
    .single();

  if (error || !data) return serverError("به‌روزرسانی آیتم خرید ناموفق بود.");

  return NextResponse.json({ item: data });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const session = await getSessionContext();
  if (!session.ok) return session.response;

  const { supabase } = session.context;

  const { error } = await supabase.from("shopping_items").delete().eq("id", id);

  if (error) return serverError("حذف آیتم خرید ناموفق بود.");

  return NextResponse.json({ ok: true });
}
