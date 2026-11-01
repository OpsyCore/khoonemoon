import { createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { fetchDueReminderCount } from "../../../mobile/src/reminder-badge";
describe("standalone reminder badge", () => {
  it("counts only the user's due undelivered reminders with snoozes", async () => {
    const fetcher = vi.fn(
      async (_url: RequestInfo | URL, _init?: RequestInit) =>
        new Response(null, {
          status: 200,
          headers: { "content-range": "0-0/3" },
        }),
    );
    const client = createClient("https://example.supabase.co", "anon", {
      global: { fetch: fetcher },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    expect(
      await fetchDueReminderCount(
        client,
        "member",
        new Date("2026-11-01T00:00:00Z"),
      ),
    ).toBe(3);
    const url = decodeURIComponent(String(fetcher.mock.calls[0][0]));
    expect(url).toContain("user_id=eq.member");
    expect(url).toContain("delivered_at=is.null");
    expect(url).toContain("snoozed_until.lte.2026-11-01T00:00:00.000Z");
    expect(fetcher.mock.calls[0][1]?.method).toBe("HEAD");
  });
});
