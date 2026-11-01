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
