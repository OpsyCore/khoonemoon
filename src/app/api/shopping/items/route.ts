import { NextResponse } from "next/server";
import { createShoppingItemSchema } from "@/features/shopping/schemas";
import {
  getSessionContext,
  serverError,
  validationError,
} from "@/lib/api/session";

const ITEM_SELECT =
  "id, list_id, name, quantity, unit, category, note, added_by, purchased, purchased_by, purchased_at, position, created_at, updated_at";

export async function GET(request: Request) {
  const session = await getSessionContext();
  if (!session.ok) return session.response;

  const { supabase } = session.context;
  const listId = new URL(request.url).searchParams.get("listId");

  if (!listId) {
    return NextResponse.json({ message: "شناسه لیست لازم است." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("shopping_items")
    .select(ITEM_SELECT)
    .eq("list_id", listId)
    .order("purchased", { ascending: true })
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) return serverError("دریافت آیتم‌های خرید ناموفق بود.");

  return NextResponse.json({ items: data ?? [] });
}

export async function POST(request: Request) {
  const session = await getSessionContext();
  if (!session.ok) return session.response;

  const { supabase, userId } = session.context;

  const parsed = createShoppingItemSchema.safeParse(await request.json());
  if (!parsed.success) return validationError(parsed.error);

  const { data, error } = await supabase
    .from("shopping_items")
    .insert({
      list_id: parsed.data.listId,
      name: parsed.data.name,
      quantity: parsed.data.quantity ?? null,
      unit: parsed.data.unit || null,
      category: parsed.data.category || null,
      note: parsed.data.note || null,
      added_by: userId,
    })
    .select(ITEM_SELECT)
    .single();

  if (error || !data) return serverError("افزودن آیتم خرید ناموفق بود.");

  return NextResponse.json({ item: data }, { status: 201 });
}
