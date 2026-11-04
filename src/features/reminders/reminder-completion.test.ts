import { expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReminderRecord } from "@/features/reminders/types";
import { completeReminderTarget } from "../../../mobile/src/reminder-completion";

const row = { target_type: "TASK", target_id: "task" } as ReminderRecord;
it("completes only the referenced task then cancels its reminder", async () => {
  const rpc = vi.fn().mockResolvedValue({ error: null });
  const cancel = vi.fn().mockResolvedValue(undefined);
  expect(
    await completeReminderTarget(
      { rpc } as unknown as SupabaseClient,
      row,
      null,
      cancel,
    ),
  ).toBe("done");
  expect(rpc).toHaveBeenCalledWith("mobile_complete_task", {
    p_task_id: "task",
  });
  expect(cancel).toHaveBeenCalledOnce();
});
it("reports partial success and never retries the target when reminder cancellation is uncertain", async () => {
  const rpc = vi.fn().mockResolvedValue({ error: null });
  expect(
    await completeReminderTarget(
      { rpc } as unknown as SupabaseClient,
      row,
      null,
      vi.fn().mockRejectedValue(new Error()),
    ),
  ).toBe("cancel-unconfirmed");
  expect(rpc).toHaveBeenCalledOnce();
});
it("does not cancel when target completion failed or is unsupported", async () => {
  const cancel = vi.fn();
  const rpc = vi.fn().mockResolvedValue({ error: {} });
  await expect(
    completeReminderTarget(
      { rpc } as unknown as SupabaseClient,
      row,
      null,
      cancel,
    ),
  ).rejects.toThrow();
  await expect(
    completeReminderTarget(
      { rpc } as unknown as SupabaseClient,
      { ...row, target_type: "EVENT" },
      null,
      cancel,
    ),
  ).rejects.toThrow();
  expect(cancel).not.toHaveBeenCalled();
});
