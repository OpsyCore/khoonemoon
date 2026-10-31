import { AuthError, createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { directFinance } from "./direct-client";

function setup(authenticated = true) {
  const fetcher = vi.fn(
    async (url: RequestInfo | URL, _init?: RequestInit) =>
      new Response(
        JSON.stringify(
          String(url).includes("household_members")
            ? { household_id: "house-1" }
            : { id: "record-1" },
        ),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
  );
  const client = createClient("https://example.supabase.co", "anon", {
    global: { fetch: fetcher },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  vi.spyOn(client.auth, "getUser").mockResolvedValue(
    authenticated
      ? { data: { user: { id: "user-1" } as never }, error: null }
      : { data: { user: null }, error: new AuthError("No session") },
  );
  return { api: directFinance(client), fetcher };
}
const input = {
  title: " قبض ",
  recordType: "BILL",
  visibility: "PRIVATE",
  amount: 123,
  currency: "IRR",
  dueAt: "2026-11-02T10:00:00.000Z",
  isRecurring: false,
};
describe("direct finance transport", () => {
  it("derives private ownership from the authenticated user, not the payload", async () => {
    const { api, fetcher } = setup();
    await api.create({ ...input, owner_id: "forged", household_id: "other" });
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toMatchObject({
      owner_id: "user-1",
      created_by: "user-1",
      household_id: null,
      title: "قبض",
      amount: 123,
    });
  });
  it("looks up current membership before inserting a shared record", async () => {
    const { api, fetcher } = setup();
    await api.create({ ...input, visibility: "HOUSEHOLD_SHARED" });
    expect(String(fetcher.mock.calls[0][0])).toContain("household_members");
    expect(JSON.parse(String(fetcher.mock.calls[1][1]?.body))).toMatchObject({
      household_id: "house-1",
      owner_id: "user-1",
    });
  });
  it("does not insert invalid bills or unauthenticated records", async () => {
    const { api, fetcher } = setup(false);
    await expect(api.create({ ...input, dueAt: null })).rejects.toThrow();
    await expect(api.create(input)).rejects.toThrow("وارد حساب");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("uses authenticated attribution when paid and clears it when unpaid", async () => {
    const { api, fetcher } = setup();
    await api.update("record-1", { paid: true, paid_by: "forged" });
    const first = JSON.parse(String(fetcher.mock.calls[0][1]?.body));
    expect(first.paid_by).toBe("user-1");
    expect(Number.isNaN(Date.parse(first.paid_at))).toBe(false);
    await api.update("record-1", { paid: false });
    expect(JSON.parse(String(fetcher.mock.calls[1][1]?.body))).toEqual({
      paid_at: null,
      paid_by: null,
    });
  });
  it("returns an error when RLS hides an updated row", async () => {
    const { api, fetcher } = setup();
    fetcher.mockResolvedValueOnce(
      new Response("null", {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    await expect(api.update("record-1", { title: "جدید" })).rejects.toThrow(
      "ناموفق",
    );
  });
});
