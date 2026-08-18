import { describe, expect, it } from "vitest";
import {
  canAccessHouseholdRecord,
  canAccessPrivateRecord,
  canModifyMembership,
  canUseInvitation,
} from "@/features/households/security";

describe("household security guards", () => {
  it("user cannot access another household", () => {
    const canAccess = canAccessHouseholdRecord({
      viewerHouseholdId: "household-a",
      targetHouseholdId: "household-b",
    });

    expect(canAccess).toBe(false);
  });

  it("partner cannot access private records", () => {
    const canAccess = canAccessPrivateRecord({
      viewerId: "user-b",
      ownerId: "user-a",
      visibility: "PRIVATE",
      viewerHouseholdId: "household-a",
      targetHouseholdId: "household-a",
    });

    expect(canAccess).toBe(false);
  });

  it("invitation cannot be reused after accepted", () => {
    const canAccess = canUseInvitation({
      status: "ACCEPTED",
      expiresAt: new Date(Date.now() + 3600_000),
      acceptedAt: new Date(),
      canceledAt: null,
      now: new Date(),
    });

    expect(canAccess).toBe(false);
  });

  it("non-owner cannot modify membership", () => {
    const canModify = canModifyMembership({
      requesterRole: "MEMBER",
      requesterId: "user-a",
      targetUserId: "user-b",
    });

    expect(canModify).toBe(false);
  });
});
