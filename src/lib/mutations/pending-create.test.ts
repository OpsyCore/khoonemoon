import { describe, it, expect, vi } from "vitest";
import { pendingCreate } from "./pending-create";

describe("pending create journal", () => {
  it("reuses the same UUID when an earlier commit has an ambiguous response", async () => {
    const ids: string[] = [];
    let phase = 0;
    const submit = vi.fn(async (id: string) => {
      ids.push(id);
      return {
        data: null,
        error: phase++ === 0 ? new Error("network") : { code: "23505" },
      };
    });
    const find = vi.fn(async (id: string) =>
      phase > 1 ? { data: { id }, error: null } : { data: null, error: null },
    );
    const request = {
      user: "retry-user",
      kind: "retry-test",
      input: { title: "fixture" },
      submit,
      find,
    };
    await expect(pendingCreate(request)).rejects.toThrow(
      "نتیجهٔ ثبت مشخص نیست",
    );
    expect(await pendingCreate(request)).toEqual({ id: ids[0] });
    expect(ids[1]).toBe(ids[0]);
    const third = await pendingCreate(request);
    expect(third).toEqual({ id: ids[2] });
    expect(ids[2]).not.toBe(ids[0]);
  });
  it("isolates users and inputs and never accepts a different row", async () => {
    const seen: string[] = [];
    const submit = async (id: string) => {
      seen.push(id);
      return { data: null, error: new Error("unknown") };
    };
    const find = async () => ({ data: { id: "other" }, error: null });
    for (const [user, input] of [
      ["u1", { x: 1 }],
      ["u1", { x: 2 }],
      ["u2", { x: 1 }],
    ] as const) {
      await expect(
        pendingCreate({ user, kind: "isolation", input, submit, find }),
      ).rejects.toThrow("نتیجهٔ ثبت مشخص نیست");
    }
    expect(new Set(seen).size).toBe(3);
  });
  it("keeps the same ID if durable follow-up persistence fails after confirmation", async () => {
    const ids: string[] = [];
    let durable = false;
    const request = {
      user: "followup-user",
      kind: "followup",
      input: { title: "same" },
      submit: async (id: string) => {
        ids.push(id);
        return { data: { id }, error: null };
      },
      find: async (id: string) => ({ data: { id }, error: null }),
      onConfirmed: () => {
        if (!durable) throw new Error("storage unavailable");
      },
    };
    await expect(pendingCreate(request)).rejects.toThrow();
    durable = true;
    expect(await pendingCreate(request)).toEqual({ id: ids[0] });
    expect(ids[1]).toBe(ids[0]);
  });
  it("shares a pending UUID for concurrent identical submissions", async () => {
    const ids: string[] = [];
    const submit = async (id: string) => {
      ids.push(id);
      await new Promise((resolve) => setTimeout(resolve, 10));
      return { data: { id }, error: null };
    };
    const request = {
      user: "concurrent",
      kind: "same",
      input: { title: "x" },
      submit,
      find: async () => ({ data: null, error: null }),
    };
    await Promise.all([pendingCreate(request), pendingCreate(request)]);
    expect(ids[0]).toBe(ids[1]);
  });
});
