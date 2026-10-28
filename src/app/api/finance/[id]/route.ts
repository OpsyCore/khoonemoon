import { NextResponse } from "next/server";
import { updateFinancialRecordSchema } from "@/features/finance/schemas";
import {
  getSessionContext,
  serverError,
  validationError,
} from "@/lib/api/session";

const RECORD_SELECT =
  "id, household_id, owner_id, created_by, visibility, record_type, title, amount, currency, category, note, occurred_at, due_at, bill_status, is_recurring, recurrence_rule, paid_by, paid_at, archived_at, created_at, updated_at";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const session = await getSessionContext();
  if (!session.ok) return session.response;

  const { supabase, userId } = session.context;

  const parsed = updateFinancialRecordSchema.safeParse(await request.json());
  if (!parsed.success) return validationError(parsed.error);

  const patch: Record<string, unknown> = {};

  if (parsed.data.title !== undefined) patch.title = parsed.data.title;
  if (parsed.data.amount !== undefined) patch.amount = parsed.data.amount;
  if (parsed.data.category !== undefined) patch.category = parsed.data.category;
  if (parsed.data.note !== undefined) patch.note = parsed.data.note;
  if (parsed.data.dueAt !== undefined) patch.due_at = parsed.data.dueAt;

  if (parsed.data.paid !== undefined) {
    patch.paid_at = parsed.data.paid ? new Date().toISOString() : null;
    patch.paid_by = parsed.data.paid ? userId : null;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ message: "تغییری ارسال نشد." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("financial_records")
    .update(patch)
    .eq("id", id)
    .select(RECORD_SELECT)
    .single();

  if (error || !data) return serverError("به‌روزرسانی اطلاعات مالی ناموفق بود.");

  return NextResponse.json({ record: data });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const session = await getSessionContext();
  if (!session.ok) return session.response;

  const { supabase } = session.context;

  const { error } = await supabase
    .from("financial_records")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return serverError("حذف اطلاعات مالی ناموفق بود.");

  return NextResponse.json({ ok: true });
}
