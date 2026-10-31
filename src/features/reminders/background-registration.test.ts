import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { registerBackgroundReminderDevice } from "../../../mobile/src/background-reminders";
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const account = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
function setup() {
  const credential = { id, account, secret: "a".repeat(64) };
  const bridge = {
    backgroundCredential: vi.fn().mockReturnValue(JSON.stringify(credential)),
    startBackground: vi.fn().mockReturnValue(true),
  };
  const rpc = vi.fn().mockResolvedValue({ error: null });
  const client = { rpc } as unknown as SupabaseClient;
  return { credential, bridge, rpc, client };
}
describe("background reminder device registration", () => {
  it("registers using the authenticated client before starting work", async () => {
    const { bridge, rpc, client, credential } = setup();
    await registerBackgroundReminderDevice(client, bridge, account, () => true);
    expect(rpc).toHaveBeenCalledWith("register_reminder_device", {
      p_id: id,
      p_secret: credential.secret,
    });
    expect(bridge.startBackground).toHaveBeenCalledWith(account, id);
    expect(rpc.mock.invocationCallOrder[0]).toBeLessThan(
      bridge.startBackground.mock.invocationCallOrder[0],
    );
  });
  it("does not register a credential belonging to a different account", async () => {
    const { bridge, rpc, client, credential } = setup();
    bridge.backgroundCredential.mockReturnValue(
      JSON.stringify({ ...credential, account: "other" }),
    );
    await expect(
      registerBackgroundReminderDevice(client, bridge, account, () => true),
    ).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });
  it("never starts work after a failed RPC or an account change", async () => {
    const { bridge, rpc, client } = setup();
    rpc.mockResolvedValueOnce({ error: { message: "denied" } });
    await expect(
      registerBackgroundReminderDevice(client, bridge, account, () => true),
    ).rejects.toThrow();
    await expect(
      registerBackgroundReminderDevice(client, bridge, account, () => false),
    ).rejects.toThrow();
    expect(bridge.startBackground).not.toHaveBeenCalled();
  });
});
