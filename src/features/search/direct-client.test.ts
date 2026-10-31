import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { searchWorkspace } from "./direct-client";
describe("standalone search", () => {
  it("uses the authenticated client's RLS-aware RPC", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValue({
        data: [{ kind: "task", entity_id: "1", title: "کار" }],
        error: null,
      });
    expect(
      await searchWorkspace({ rpc } as unknown as SupabaseClient, " کار "),
    ).toHaveLength(1);
    expect(rpc).toHaveBeenCalledWith("search_workspace", {
      p_query: "کار",
      p_limit: 50,
    });
  });
  it("refuses short or overly long searches before database requests", async () => {
    const rpc = vi.fn();
    const client = { rpc } as unknown as SupabaseClient;
    expect(await searchWorkspace(client, "a")).toEqual([]);
    await expect(searchWorkspace(client, "a".repeat(101))).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });
  it("reports errors instead of showing stale data", async () => {
    const client = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: {} }),
    } as unknown as SupabaseClient;
    await expect(searchWorkspace(client, "خرید")).rejects.toThrow();
  });
});
