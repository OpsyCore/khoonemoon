import { beforeEach, describe, expect, it, vi } from "vitest";

const { selections, getSessionContext } = vi.hoisted(() => ({
  selections: new Map<string, string>(),
  getSessionContext: vi.fn(),
}));

vi.mock("@/lib/api/session", () => ({
  getSessionContext,
  serverError: (message: string) => Response.json({ message }, { status: 500 }),
}));

import { GET } from "./route";

describe("data export", () => {
  beforeEach(() => {
    selections.clear();
    getSessionContext.mockResolvedValue({
      ok: true,
      context: {
        supabase: {
          from(table: string) {
            const query = {
              select(columns: string) {
                selections.set(table, columns);
                return query;
              },
              order() {
                return query;
              },
              limit() {
                return Promise.resolve({ data: [], error: null });
              },
            };
            return query;
          },
        },
      },
    });
  });

  it("uses actual shopping columns and exports both tables", async () => {
    const response = await GET(new Request("https://example.test/api/export"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(selections.get("shopping_lists")).toContain("name");
    expect(selections.get("shopping_lists")).not.toContain("title");
    expect(selections.get("shopping_items")).toContain("purchased");
    expect(selections.get("shopping_items")).not.toContain("is_checked");
    expect(body.tables.shopping_lists).toEqual([]);
    expect(body.tables.shopping_items).toEqual([]);
  });
});
