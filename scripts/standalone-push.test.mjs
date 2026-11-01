import { describe, it, expect, vi } from "vitest";
import {
  configFromEnv,
  dispatchBatch,
  safeMozillaEndpoint,
} from "./standalone-push.mjs";
const job = (
  id,
  endpoint = "https://updates.push.services.mozilla.com/wpush/x",
) => ({
  job_id: id,
  token: `token-${id}`,
  endpoint,
  p256dh: "key",
  auth: "auth",
});
function clientFor(jobs, valid = true) {
  return {
    rpc: vi.fn(async (name, args) => {
      if (name === "standalone_push_claim") return { data: jobs, error: null };
      if (name === "standalone_push_validate")
        return { data: valid, error: null };
      if (name === "standalone_push_finish") return { data: true, error: null };
      throw new Error("unexpected RPC");
    }),
  };
}
describe("standalone push worker", () => {
  it("rejects Firebase, private and deceptive hosts", () => {
    for (const url of [
      "https://fcm.googleapis.com/x",
      "http://push.services.mozilla.com/x",
      "https://push.services.mozilla.com.example.com/x",
      "https://user:pass@push.services.mozilla.com/x",
    ])
      expect(safeMozillaEndpoint(url)).toBe(false);
    expect(safeMozillaEndpoint("https://push.services.mozilla.com/x")).toBe(
      true,
    );
  });
  it("requires server-only config and a clean https origin", () => {
    const env = {
      SUPABASE_URL: "https://project.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "private",
      VAPID_PUBLIC_KEY: "public",
      VAPID_PRIVATE_KEY: "secret",
      VAPID_SUBJECT: "mailto:test@example.com",
    };
    expect(configFromEnv(env).url).toBe(env.SUPABASE_URL);
    expect(() =>
      configFromEnv({
        ...env,
        SUPABASE_URL: "https://project.supabase.co/?key=secret",
      }),
    ).toThrow();
    expect(() => configFromEnv({ ...env, VAPID_PRIVATE_KEY: "" })).toThrow();
  });
  it("validates, sends then acknowledges without exposing reminder content", async () => {
    const client = clientFor([job("1")]);
    const send = vi.fn().mockResolvedValue(undefined);
    const result = await dispatchBatch({ client, send });
    expect(result.sent).toBe(1);
    expect(send).toHaveBeenCalledWith({
      endpoint: job("1").endpoint,
      keys: { p256dh: "key", auth: "auth" },
    });
    expect(client.rpc).toHaveBeenCalledWith("standalone_push_finish", {
      p_job: "1",
      p_token: "token-1",
      p_result: "sent",
    });
  });
  it("retries transient errors and expires gone endpoints", async () => {
    const client = clientFor([job("1"), job("2")]);
    const send = vi
      .fn()
      .mockRejectedValueOnce({ statusCode: 503 })
      .mockRejectedValueOnce({ statusCode: 410 });
    const result = await dispatchBatch({ client, send });
    expect(result.retry).toBe(1);
    expect(result.expired).toBe(1);
  });
  it("does not send an invalidated or disallowed lease", async () => {
    const client = clientFor(
      [job("1"), job("2", "https://fcm.googleapis.com/device")],
      false,
    );
    const send = vi.fn();
    const result = await dispatchBatch({ client, send });
    expect(send).not.toHaveBeenCalled();
    expect(result.retry).toBe(1);
    expect(result.stale).toBe(1);
  });
  it("does not acknowledge when lease validation fails", async () => {
    const client = clientFor([job("1")]);
    client.rpc.mockImplementation(async (name) =>
      name === "standalone_push_claim"
        ? { data: [job("1")] }
        : { error: new Error() },
    );
    const send = vi.fn();
    const result = await dispatchBatch({ client, send });
    expect(result.errors).toBe(1);
    expect(send).not.toHaveBeenCalled();
    expect(client.rpc).not.toHaveBeenCalledWith(
      "standalone_push_finish",
      expect.anything(),
    );
  });
});
