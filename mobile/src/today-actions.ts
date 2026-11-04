import type { SupabaseClient } from "@supabase/supabase-js";

/** Mutations act on the displayed occurrence, never on stale dashboard state. */
export async function completeTodayChore(
  client: SupabaseClient,
  id: string,
  due: string,
) {
  const { data, error } = await client.rpc("complete_chore_expected_due", {
    p_chore_id: id,
    p_expected_due: due,
  });
  if (error || !data)
    throw new Error("وضعیت کار خانه تغییر کرد یا ثبت آن تأیید نشد.");
}
export async function payTodayBill(client: SupabaseClient, id: string) {
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth.user) throw new Error("ابتدا وارد حساب خود شوید.");
  const { data, error } = await client
    .from("financial_records")
    .update({ paid_at: new Date().toISOString(), paid_by: auth.user.id })
    .eq("id", id)
    .in("record_type", ["BILL", "SUBSCRIPTION", "INSTALLMENT"])
    .is("paid_at", null)
    .is("archived_at", null)
    .select("id")
    .maybeSingle();
  if (error || !data)
    throw new Error("وضعیت قبض تغییر کرد یا پرداخت آن تأیید نشد.");
}
