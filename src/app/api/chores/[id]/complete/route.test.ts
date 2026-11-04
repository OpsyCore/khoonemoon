import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), session: vi.fn() }));
vi.mock("@/lib/api/session", () => ({ getSessionContext: mocks.session }));
import { POST } from "./route";
const context = { params: Promise.resolve({ id: "fixture-chore" }) };
function request(body: unknown) {
  return new Request("http://example.test/api/chores/fixture/complete", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
describe("guarded web chore completion", () => {
  beforeEach(() => {
    mocks.rpc.mockReset();
    mocks.session.mockResolvedValue({
      ok: true,
      context: { supabase: { rpc: mocks.rpc } },
    });
  });
  it("refuses a request without the displayed revision instead of using the unguarded RPC", async () => {
    expect((await POST(request({}), context)).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("sends the original revision and surfaces conflicts", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: "completion", error: null });
    expect((await POST(request({ expectedRevision: 5 }), context)).status).toBe(
      200,
    );
    expect(mocks.rpc).toHaveBeenCalledWith("complete_chore_expected_version", {
      p_chore_id: "fixture-chore",
      p_expected_version: 5,
    });
    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: "CHORE_VERSION_CHANGED" },
    });
    expect((await POST(request({ expectedRevision: 5 }), context)).status).toBe(
      409,
    );
  });
});
