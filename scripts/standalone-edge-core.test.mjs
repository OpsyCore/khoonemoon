import { describe, expect, it, vi } from "vitest";
import { handlePush } from "../supabase/functions/standalone-push/core.mjs";
const nonce = "a".repeat(64);
const job = {
  job_id: "job",
  token: "lease",
  endpoint: "https://updates.push.services.mozilla.com/wpush/v2/abc",
  p256dh: "a",
  auth: "b",
};
function setup({
  valid = true,
  jobs = [],
  send = vi.fn().mockResolvedValue(undefined),
} = {}) {
  const rpc = vi.fn(async (name) => {
    if (name === "standalone_push_consume_nonce") return valid;
    if (name === "standalone_push_vapid")
      return { public_key: "pub", private_key: "priv" };
    if (name === "standalone_push_claim") return jobs;
    return true;
  });
  return {
    rpc,
    send,
    generateVapid: vi.fn(() => ({ publicKey: "pub", privateKey: "priv" })),
    setVapid: vi.fn(),
    subject: "https://example.com",
  };
}
const request = (token = nonce) =>
  new Request("https://example.com", {
    method: "POST",
    headers: { "x-dispatch-nonce": token },
  });
describe("standalone Edge sender", () => {
  it("rejects absent, invalid and consumed nonces before reading keys or queue", async () => {
    const a = setup();
    expect((await handlePush(request("bad"), a)).status).toBe(401);
    expect(a.rpc).not.toHaveBeenCalled();
    const b = setup({ valid: false });
    expect((await handlePush(request(), b)).status).toBe(401);
    expect(b.generateVapid).not.toHaveBeenCalled();
  });
  it("checks eligibility, delivers Mozilla only, then finishes the lease", async () => {
    const deps = setup({ jobs: [job] });
    expect((await handlePush(request(), deps)).status).toBe(204);
    expect(deps.send).toHaveBeenCalledOnce();
    expect(deps.rpc).toHaveBeenCalledWith("standalone_push_finish", {
      p_job: "job",
      p_token: "lease",
      p_result: "sent",
    });
  });
  it("never sends to a non-Mozilla endpoint and retries on delivery errors", async () => {
    const bad = setup({ jobs: [{ ...job, endpoint: "https://evil.test/" }] });
    await handlePush(request(), bad);
    expect(bad.send).not.toHaveBeenCalled();
    expect(bad.rpc).toHaveBeenCalledWith(
      "standalone_push_finish",
      expect.objectContaining({ p_result: "stale" }),
    );
    const failed = setup({
      jobs: [job],
      send: vi.fn().mockRejectedValue({ statusCode: 503 }),
    });
    await handlePush(request(), failed);
    expect(failed.rpc).toHaveBeenCalledWith(
      "standalone_push_finish",
      expect.objectContaining({ p_result: "retry" }),
    );
  });
});
