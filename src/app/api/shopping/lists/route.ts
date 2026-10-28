import { NextResponse } from "next/server";
import { createShoppingListSchema } from "@/features/shopping/schemas";
import {
  getSessionContext,
  requireHousehold,
  serverError,
  validationError,
} from "@/lib/api/session";

export async function GET() {
  const session = await getSessionContext();
  if (!session.ok) return session.response;

  const { supabase, householdId } = session.context;
  if (!householdId) return NextResponse.json({ lists: [] });

  const { data, error } = await supabase
    .from("shopping_lists")
    .select("id, household_id, name, created_by, archived_at, created_at, updated_at")
    .eq("household_id", householdId)
    .is("archived_at", null)
    .order("created_at", { ascending: true });

  if (error) return serverError("دریافت لیست‌های خرید ناموفق بود.");

  return NextResponse.json({ lists: data ?? [] });
}

export async function POST(request: Request) {
  const session = await getSessionContext();
  if (!session.ok) return session.response;

  const guard = requireHousehold(session.context);
  if (guard) return guard;

  const { supabase, userId, householdId } = session.context;

  const parsed = createShoppingListSchema.safeParse(await request.json());
  if (!parsed.success) return validationError(parsed.error);

  const { data, error } = await supabase
    .from("shopping_lists")
    .insert({
      household_id: householdId,
      name: parsed.data.name,
      created_by: userId,
    })
    .select("id, household_id, name, created_by, archived_at, created_at, updated_at")
    .single();

  if (error || !data) return serverError("ایجاد لیست خرید ناموفق بود.");

  return NextResponse.json({ list: data }, { status: 201 });
}
