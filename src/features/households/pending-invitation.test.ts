import { describe, expect, it } from "vitest";
import { pendingInvitation } from "./pending-invitation";

describe("pending invitation", () => {
  it("reuses the bearer code and expiry after a lost response, then clears it", async () => {
    const calls: [string, string][] = [];
    const send = async (hash: string, expiry: string) => {
      calls.push([hash, expiry]);
      return calls.length > 1;
    };
    await expect(
      pendingInvitation("fixture-user", "fixture-house", send),
    ).rejects.toThrow("نتیجهٔ دعوت");
    const result = await pendingInvitation(
      "fixture-user",
      "fixture-house",
      send,
    );
    expect(calls[1]).toEqual(calls[0]);
    expect(result.expiresAt).toBe(calls[0][1]);
    await pendingInvitation("fixture-user", "fixture-house", send);
    expect(calls[2][0]).not.toBe(calls[0][0]);
  });
  it("keeps different users and households isolated", async () => {
    const hashes: string[] = [];
    for (const [user, house] of [
      ["alice", "h1"],
      ["alice", "h2"],
      ["bob", "h1"],
    ]) {
      await expect(
        pendingInvitation(user, house, async (hash) => {
          hashes.push(hash);
          return false;
        }),
      ).rejects.toThrow();
    }
    expect(new Set(hashes).size).toBe(3);
  });
});

it("transfers the same pending invitation only to the same owner and house", async () => {
  const { exportPendingInvitation, importPendingInvitation } =
    await import("./pending-invitation");
  const makeStore = () => {
    const map = new Map<string, string>();
    return {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => {
        map.set(k, v);
      },
      removeItem: (k: string) => {
        map.delete(k);
      },
    };
  };
  const first = makeStore(),
    second = makeStore();
  const { vi } = await import("vitest");
  try {
    vi.stubGlobal("window", { localStorage: first });
    let original = "";
    await expect(
      pendingInvitation("owner", "house", async (hash) => {
        original = hash;
        return false;
      }),
    ).rejects.toThrow();
    const token = exportPendingInvitation("owner", "house");
    expect(token).toMatch(/^KHI1\./);
    vi.stubGlobal("window", { localStorage: second });
    await expect(
      importPendingInvitation("other", "house", token!),
    ).rejects.toThrow();
    await expect(
      importPendingInvitation("owner", "other", token!),
    ).rejects.toThrow();
    await importPendingInvitation("owner", "house", token!);
    let retried = "";
    await pendingInvitation("owner", "house", async (hash) => {
      retried = hash;
      return true;
    });
    expect(retried).toBe(original);
    expect(exportPendingInvitation("owner", "house")).toBeNull();
  } finally {
    vi.unstubAllGlobals();
  }
});

it("does not overwrite a different unresolved invitation on the destination", async () => {
  const { exportPendingInvitation, importPendingInvitation } =
    await import("./pending-invitation");
  const { vi } = await import("vitest");
  const makeStore = () => {
    const map = new Map<string, string>();
    return {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => {
        map.set(k, v);
      },
      removeItem: (k: string) => {
        map.delete(k);
      },
    };
  };
  try {
    const first = makeStore(),
      second = makeStore();
    vi.stubGlobal("window", { localStorage: first });
    await expect(
      pendingInvitation("owner", "house", async () => false),
    ).rejects.toThrow();
    const code = exportPendingInvitation("owner", "house")!;
    vi.stubGlobal("window", { localStorage: second });
    await expect(
      pendingInvitation("owner", "house", async () => false),
    ).rejects.toThrow();
    const before = exportPendingInvitation("owner", "house");
    await expect(
      importPendingInvitation("owner", "house", code),
    ).rejects.toThrow("جایگزین نشد");
    expect(exportPendingInvitation("owner", "house")).toBe(before);
  } finally {
    vi.unstubAllGlobals();
  }
});
