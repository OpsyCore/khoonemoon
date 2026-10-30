import { describe, expect, it, vi } from "vitest";
import type { SupabaseServerClient } from "@/lib/api/session";
import { loadHouseholdMembers } from "./members";

function clientFor(members: unknown[], profiles: unknown[]) {
  const selects: string[] = [];
  const client = {
    from(table: string) {
      const builder = {
        select(value: string) {
          selects.push(`${table}:${value}`);
          return builder;
        },
        eq: () => builder,
        is: () => builder,
        order: async () => ({ data: members, error: null }),
        in: async () => ({ data: profiles, error: null }),
      };
      return builder;
    },
  } as unknown as SupabaseServerClient;
  return { client, selects };
}

describe("household members", () => {
  it("loads profiles separately and retains members invisible under profile RLS", async () => {
    const { client, selects } = clientFor(
      [
        {
          id: "m1",
          user_id: "u1",
          role: "OWNER",
          joined_at: "2026-01-01",
          left_at: null,
        },
        {
          id: "m2",
          user_id: "u2",
          role: "MEMBER",
          joined_at: "2026-01-02",
          left_at: null,
        },
      ],
      [{ id: "u1", full_name: "سارا" }],
    );
    const result = await loadHouseholdMembers(client, "household");
    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(2);
    expect(result.data[0].profiles?.[0].full_name).toBe("سارا");
    expect(result.data[1].profiles).toBeNull();
    expect(selects).toEqual([
      "household_members:id, user_id, role, joined_at, left_at",
      "profiles:id, full_name",
    ]);
    expect(selects.join(" ")).not.toContain("profiles(");
  });
  it("does not query profiles for an empty household", async () => {
    const { client, selects } = clientFor([], []);
    expect((await loadHouseholdMembers(client, "empty")).data).toEqual([]);
    expect(selects).toHaveLength(1);
  });
});
