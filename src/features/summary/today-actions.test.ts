import { createClient, AuthError } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import {
  completeTodayChore,
  payTodayBill,
} from "../../../mobile/src/today-actions";
function setup() {
  const fetcher = vi.fn(
    async (_url: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify({ id: "id" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
  );
  const client = createClient("https://example.supabase.co", "anon", {
    global: { fetch: fetcher },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  vi.spyOn(client.auth, "getUser").mockResolvedValue({
    data: { user: { id: "user-1" } as never },
    error: null,
  });
  return { client, fetcher };
}
describe("today direct actions", () => {
  it("completes only the exact displayed chore occurrence", async () => {
    const { client, fetcher } = setup();
    await completeTodayChore(client, "c1", "2026-01-01T12:00:00Z");
    expect(String(fetcher.mock.calls[0][0])).toContain(
      "complete_chore_expected_due",
    );
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual({
      p_chore_id: "c1",
      p_expected_due: "2026-01-01T12:00:00Z",
    });
  });
  it("pays only an accessible unpaid, non-archived bill", async () => {
    const { client, fetcher } = setup();
    await payTodayBill(client, "bill-1");
    const url = decodeURIComponent(String(fetcher.mock.calls[0][0]));
    expect(url).toContain("paid_at=is.null");
    expect(url).toContain("archived_at=is.null");
    expect(url).toContain("record_type=in.(BILL,SUBSCRIPTION,INSTALLMENT)");
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body)).paid_by).toBe(
      "user-1",
    );
    fetcher.mockResolvedValueOnce(
      new Response("null", {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    await expect(payTodayBill(client, "bill-1")).rejects.toThrow();
  });
  it("rejects payment without authentication", async () => {
    const { client, fetcher } = setup();
    vi.mocked(client.auth.getUser).mockResolvedValue({
      data: { user: null },
      error: new AuthError("no session"),
    });
    await expect(payTodayBill(client, "bill-1")).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
