import { describe, it, expect, vi } from "vitest";

const { session } = vi.hoisted(() => ({ session: vi.fn() }));
vi.mock("@/lib/api/session", () => ({
  getSessionContext: session,
  serverError: (message: string) => Response.json({ message }, { status: 500 }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => null,
}));
import { POST } from "./route";

describe("reminder dispatch concurrency", () => {
  it("does not dispatch a reminder changed or claimed by another request", async () => {
    const row = {
      id: "a",
      user_id: "user",
      target_type: "TASK",
      target_id: "task",
      household_id: null,
      remind_at: "2020-01-01T00:00:00Z",
      status: "PENDING",
      snoozed_until: null,
      snooze_count: 0,
      delivered_at: null,
      created_at: "2020-01-01T00:00:00Z",
      updated_at: "2020-01-01T00:00:00Z",
    };
    const comparisons: [string, unknown][] = [];
    let dueFilter = "";
    const supabase = {
      from(table: string) {
        let updating = false;
        const query = {
          select() {
            return query;
          },
          update() {
            updating = true;
            return query;
          },
          or(value: string) {
            dueFilter = value;
            return query;
          },
          order() {
            return query;
          },
          limit() {
            return query;
          },
          eq(key: string, value: unknown) {
            if (updating) comparisons.push([key, value]);
            return query;
          },
          in() {
            return query;
          },
          maybeSingle() {
            return Promise.resolve({ data: null, error: null });
          },
          then(resolve: (value: unknown) => unknown) {
            return Promise.resolve({
              data: table === "reminders" ? [row] : [],
              error: null,
            }).then(resolve);
          },
        };
        return query;
      },
    };
    session.mockResolvedValue({
      ok: true,
      context: { supabase, userId: "user" },
    });
    const response = await POST(
      new Request("https://example.test/api/reminders/dispatch", {
        method: "POST",
      }),
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.dispatched).toBe(0);
    expect(body.notifications).toEqual([]);
    expect(comparisons).toContainEqual(["updated_at", row.updated_at]);
    expect(comparisons).toContainEqual(["status", "PENDING"]);
    expect(dueFilter).toContain("snoozed_until.lte.");
  });
});
