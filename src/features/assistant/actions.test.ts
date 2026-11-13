import { describe, expect, it } from "vitest";
import { signAssistantAction, verifyAssistantAction } from "./actions";

const identity = {
  userId: "60000000-0000-4000-8000-000000000011",
  householdId: "60000000-0000-4000-8000-000000000012",
};
const action = {
  type: "create_household_task" as const,
  payload: {
    title: "آبیاری گل‌ها",
    visibility: "HOUSEHOLD_SHARED" as const,
    priority: "NORMAL" as const,
    status: "PENDING" as const,
    dueAt: null,
    assigneeIds: [identity.userId],
    recurrence: { frequency: "NONE" as const },
  },
};
const secret = "a-test-signing-secret-that-is-long-enough-32-bytes";

describe("signed assistant action approvals", () => {
  it("binds the exact action, user and household with a short expiry", async () => {
    const signed = await signAssistantAction(
      action,
      identity,
      secret,
      1_000_000,
    );
    const claims = await verifyAssistantAction(
      signed.token,
      secret,
      identity,
      1_000_001,
    );
    expect(claims.action).toEqual(action);
    expect(claims.expiresAt).toBe(1_600_000);
    expect(claims.requestId).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it("rejects cross-user, changed-house and modified tokens", async () => {
    const { token } = await signAssistantAction(
      action,
      identity,
      secret,
      2_000_000,
    );
    await expect(
      verifyAssistantAction(
        token,
        secret,
        { ...identity, userId: "60000000-0000-4000-8000-000000000013" },
        2_000_001,
      ),
    ).rejects.toThrow("ACTION_CONTEXT_CHANGED");
    await expect(
      verifyAssistantAction(
        token,
        secret,
        { ...identity, householdId: null },
        2_000_001,
      ),
    ).rejects.toThrow("ACTION_CONTEXT_CHANGED");
    await expect(
      verifyAssistantAction(
        `${token.slice(0, -1)}x`,
        secret,
        identity,
        2_000_001,
      ),
    ).rejects.toThrow("INVALID_ACTION_TOKEN");
  });

  it("rejects expired, overlong and unsigned action payloads", async () => {
    const { token } = await signAssistantAction(
      action,
      identity,
      secret,
      3_000_000,
    );
    await expect(
      verifyAssistantAction(token, secret, identity, 3_600_000),
    ).rejects.toThrow("ACTION_TOKEN_EXPIRED");
    await expect(
      verifyAssistantAction("x".repeat(12001), secret, identity),
    ).rejects.toThrow("INVALID_ACTION_TOKEN");
    await expect(
      signAssistantAction(action, identity, "short", 3_000_000),
    ).rejects.toThrow("ACTION_SIGNING_DISABLED");
  });
});
