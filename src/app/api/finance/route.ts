import { NextResponse } from "next/server";
import { createFinancialRecordSchema } from "@/features/finance/schemas";
import {
  getSessionContext,
  serverError,
  validationError,
} from "@/lib/api/session";

const RECORD_SELECT =
  "id, household_id, owner_id, created_by, visibility, record_type, title, amount, currency, category, note, occurred_at, due_at, bill_status, is_recurring, recurrence_rule, paid_by, paid_at, archived_at, created_at, updated_at";

export async function GET() {
  const session = await getSessionContext();
  if (!session.ok) return session.response;

  const { supabase } = session.context;

  const { data, error } = await supabase
    .from("financial_records")
    .select(RECORD_SELECT)
    .is("archived_at", null)
    .order("occurred_at", { ascending: false })
    .limit(200);

  if (error) return serverError("دریافت اطلاعات مالی ناموفق بود.");

  return NextResponse.json({ records: data ?? [] });
}

export async function POST(request: Request) {
  const session = await getSessionContext();
  if (!session.ok) return session.response;

  const { supabase, userId, householdId } = session.context;

  const parsed = createFinancialRecordSchema.safeParse(await request.json());
  if (!parsed.success) return validationError(parsed.error);

  const input = parsed.data;

  if (input.visibility === "HOUSEHOLD_SHARED" && !householdId) {
    return NextResponse.json(
      { message: "برای ثبت مالی مشترک باید عضو یک خانه باشید." },
      { status: 409 },
    );
  }

  const { data, error } = await supabase
    .from("financial_records")
    .insert({
      household_id:
        input.visibility === "HOUSEHOLD_SHARED" ? householdId : null,
      owner_id: userId,
      created_by: userId,
      visibility: input.visibility,
      record_type: input.recordType,
      title: input.title,
      amount: input.amount,
      currency: input.currency,
      category: input.category || null,
      note: input.note || null,
      occurred_at: input.occurredAt ?? new Date().toISOString(),
      due_at: input.dueAt ?? null,
      is_recurring: input.isRecurring,
    })
    .select(RECORD_SELECT)
    .single();

  if (error || !data) return serverError("ثبت اطلاعات مالی ناموفق بود.");

  return NextResponse.json({ record: data }, { status: 201 });
}
