import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { searchWorkspace, searchWorkspaceFiltered } from "./direct-client";
describe("standalone search", () => {
  it("uses the authenticated client's RLS-aware RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({
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

describe("filtered standalone search", () => {
  it("passes kind, time window and page to the RLS-aware RPC", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValue({
        data: {
          results: [{ kind: "task", entity_id: "a", title: "x" }],
          counts: { task: 56 },
          total: 56,
        },
        error: null,
      });
    const result = await searchWorkspaceFiltered(
      { rpc } as unknown as SupabaseClient,
      " test ",
      { kinds: ["task"], range: "WEEK" },
      new Date("2026-11-01T12:00:00Z"),
      50,
    );
    expect(result.total).toBe(56);
    expect(rpc).toHaveBeenCalledWith("search_workspace_filtered", {
      p_query: "test",
      p_kinds: ["task"],
      p_since: "2026-10-25T12:00:00.000Z",
      p_until: "2026-11-02T12:00:00.000Z",
      p_offset: 50,
    });
  });
});
