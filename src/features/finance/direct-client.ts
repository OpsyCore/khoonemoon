import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createFinancialRecordSchema,
  updateFinancialRecordSchema,
} from "./schemas";
import type { FinancialRecord } from "./types";

const COLUMNS =
  "id, household_id, owner_id, created_by, visibility, record_type, title, amount, currency, category, note, occurred_at, due_at, bill_status, is_recurring, recurrence_rule, paid_by, paid_at, archived_at, created_at, updated_at";
async function userId(client: SupabaseClient) {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error("ابتدا وارد حساب خود شوید.");
  return data.user.id;
}
/** Uses the user's JWT and Supabase RLS; no privileged client credentials. */
export function directFinance(client: SupabaseClient) {
  return {
    async list(): Promise<FinancialRecord[]> {
      const records: FinancialRecord[] = [];
      const size = 500;
      for (let offset = 0; ; offset += size) {
        const { data, error } = await client
          .from("financial_records")
          .select(COLUMNS)
          .is("archived_at", null)
          .order("occurred_at", { ascending: false })
          .order("id", { ascending: false })
          .range(offset, offset + size - 1);
        if (error) throw new Error("دریافت اطلاعات مالی ناموفق بود.");
        records.push(...((data ?? []) as FinancialRecord[]));
        if (!data || data.length < size) return records;
        if (records.length >= 10000)
          throw new Error(
            "تعداد اطلاعات مالی بیش از حد مجاز است؛ گزارش ناقص نمایش داده نمی‌شود.",
          );
      }
    },
    async create(input: unknown): Promise<FinancialRecord> {
      const record = createFinancialRecordSchema.parse(input);
      const user = await userId(client);
      let householdId: string | null = null;
      if (record.visibility === "HOUSEHOLD_SHARED") {
        const { data, error } = await client
          .from("household_members")
          .select("household_id")
          .eq("user_id", user)
          .is("left_at", null)
          .maybeSingle();
        if (error || !data?.household_id)
          throw new Error("برای ثبت مالی مشترک باید عضو یک خانه باشید.");
        householdId = data.household_id;
      }
      const { data, error } = await client
        .from("financial_records")
        .insert({
          household_id: householdId,
          owner_id: user,
          created_by: user,
          visibility: record.visibility,
          record_type: record.recordType,
          title: record.title,
          amount: record.amount,
          currency: record.currency,
          category: record.category || null,
          note: record.note || null,
          occurred_at: record.occurredAt ?? new Date().toISOString(),
          due_at: record.dueAt ?? null,
          is_recurring: record.isRecurring,
        })
        .select(COLUMNS)
        .single();
      if (error || !data) throw new Error("ثبت اطلاعات مالی ناموفق بود.");
      return data as FinancialRecord;
    },
    async update(id: string, input: unknown): Promise<FinancialRecord> {
      const record = updateFinancialRecordSchema.parse(input);
      if (!Object.keys(record).length) throw new Error("تغییری ارسال نشد.");
      const patch: Record<string, unknown> = {};
      if (record.title !== undefined) patch.title = record.title;
      if (record.amount !== undefined) patch.amount = record.amount;
      if (record.category !== undefined) patch.category = record.category;
      if (record.note !== undefined) patch.note = record.note;
      if (record.dueAt !== undefined) patch.due_at = record.dueAt;
      if (record.paid !== undefined) {
        const user = await userId(client);
        patch.paid_at = record.paid ? new Date().toISOString() : null;
        patch.paid_by = record.paid ? user : null;
      }
      const { data, error } = await client
        .from("financial_records")
        .update(patch)
        .eq("id", id)
        .select(COLUMNS)
        .maybeSingle();
      if (error || !data)
        throw new Error("به‌روزرسانی اطلاعات مالی ناموفق بود.");
      return data as FinancialRecord;
    },
    async archive(id: string): Promise<void> {
      const { data, error } = await client
        .from("financial_records")
        .update({ archived_at: new Date().toISOString() })
        .eq("id", id)
        .select("id")
        .maybeSingle();
      if (error || !data) throw new Error("بایگانی اطلاعات مالی ناموفق بود.");
    },
  };
}
