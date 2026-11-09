import { pendingRequest } from "@/lib/mutations/pending-create";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReminderRecord } from "@/features/reminders/types";
import { completeTodayChore, payTodayBill } from "./today-actions";

/** The target and reminder are separate transactions; don't retry the target if cancellation is uncertain. */
export async function completeReminderTarget(
  client: SupabaseClient,
  row: ReminderRecord,
  targetDue: string | null,
  cancel: () => Promise<void>,
): Promise<"done" | "cancel-unconfirmed"> {
  if (row.target_type === "TASK") {
    const { error } = await client.rpc("mobile_complete_task", {
      p_task_id: row.target_id,
    });
    if (error) throw new Error("ثبت انجام کار تأیید نشد.");
  } else if (row.target_type === "CHORE" && targetDue) {
    await completeTodayChore(client, row.target_id, targetDue);
  } else if (row.target_type === "BILL") {
    await payTodayBill(client, row.target_id);
  } else if (row.target_type === "APPLIANCE") {
    const payload = {
      applianceId: row.target_id,
      kind: "SERVICE",
      title: "سرویس دوره‌ای انجام شد",
      reminderOffsetsMinutes: [10080, 1440],
    };
    await pendingRequest<string>({
      user: row.user_id,
      kind: "appliance-maintenance",
      input: payload,
      submit: (requestId) =>
        client.rpc("record_appliance_maintenance", {
          p_input: { ...payload, requestId },
        }),
      valid: (v): v is string =>
        typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v),
    });
    return "done";
  } else throw new Error("این مورد قابل تکمیل نیست.");
  try {
    await cancel();
    return "done";
  } catch {
    return "cancel-unconfirmed";
  }
}
