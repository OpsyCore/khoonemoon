import { describe, expect, it } from "vitest";
import {
  canAccessHouseholdRecord,
  canAccessPrivateRecord,
  canModifyMembership,
  canUseInvitation,
} from "@/features/households/security";

describe("household security guards", () => {
  it("user cannot access another household", () => {
    expect(
      canAccessHouseholdRecord({
        viewerHouseholdId: "household-a",
        targetHouseholdId: "household-b",
      }),
    ).toBe(false);
  });

  it("member can access their own household", () => {
    expect(
      canAccessHouseholdRecord({
        viewerHouseholdId: "household-a",
        targetHouseholdId: "household-a",
      }),
    ).toBe(true);
  });

  it("denies household access when the viewer has no household", () => {
    expect(
      canAccessHouseholdRecord({
        viewerHouseholdId: null,
        targetHouseholdId: "household-a",
      }),
    ).toBe(false);
  });

  it("partner cannot access private records", () => {
    expect(
      canAccessPrivateRecord({
        viewerId: "user-b",
        ownerId: "user-a",
        visibility: "PRIVATE",
        viewerHouseholdId: "household-a",
        targetHouseholdId: "household-a",
      }),
    ).toBe(false);
  });

  it("owner can access a private record", () => {
    expect(
      canAccessPrivateRecord({
        viewerId: "user-a",
        ownerId: "user-a",
        visibility: "PRIVATE",
        viewerHouseholdId: "household-a",
        targetHouseholdId: "household-a",
      }),
    ).toBe(true);
  });

  it("household members can access shared records in the same household", () => {
    expect(
      canAccessPrivateRecord({
        viewerId: "user-b",
        ownerId: "user-a",
        visibility: "HOUSEHOLD_SHARED",
        viewerHouseholdId: "household-a",
        targetHouseholdId: "household-a",
      }),
    ).toBe(true);
  });

  it("denies shared records without a household id", () => {
    expect(
      canAccessPrivateRecord({
        viewerId: "user-a",
        ownerId: "user-a",
        visibility: "HOUSEHOLD_SHARED",
        viewerHouseholdId: "household-a",
        targetHouseholdId: null,
      }),
    ).toBe(false);
  });

  it("invitation cannot be reused after accepted", () => {
    expect(
      canUseInvitation({
        status: "ACCEPTED",
        expiresAt: new Date(Date.now() + 3600_000),
        acceptedAt: new Date(),
        canceledAt: null,
        now: new Date(),
      }),
    ).toBe(false);
  });

  it("rejects canceled, expired, and already-used invitations", () => {
    const now = new Date("2026-08-28T12:00:00.000Z");

    expect(
      canUseInvitation({
        status: "CANCELED",
        expiresAt: new Date("2026-08-29T12:00:00.000Z"),
        acceptedAt: null,
        canceledAt: now,
        now,
      }),
    ).toBe(false);

    expect(
      canUseInvitation({
        status: "PENDING",
        expiresAt: new Date("2026-08-27T12:00:00.000Z"),
        acceptedAt: null,
        canceledAt: null,
        now,
      }),
    ).toBe(false);

    expect(
      canUseInvitation({
        status: "PENDING",
        expiresAt: new Date("2026-08-29T12:00:00.000Z"),
        acceptedAt: now,
        canceledAt: null,
        now,
      }),
    ).toBe(false);

    expect(
      canUseInvitation({
        status: "PENDING",
        expiresAt: new Date("2026-08-29T12:00:00.000Z"),
        acceptedAt: null,
        canceledAt: null,
        now,
      }),
    ).toBe(true);
  });

  it("non-owner cannot modify membership", () => {
    expect(
      canModifyMembership({
        requesterRole: "MEMBER",
        requesterId: "user-a",
        targetUserId: "user-b",
      }),
    ).toBe(false);
  });

  it("owner cannot use membership-modify against themselves", () => {
    expect(
      canModifyMembership({
        requesterRole: "OWNER",
        requesterId: "user-a",
        targetUserId: "user-a",
      }),
    ).toBe(false);
  });

  it("owner can modify another member", () => {
    expect(
      canModifyMembership({
        requesterRole: "OWNER",
        requesterId: "user-a",
        targetUserId: "user-b",
      }),
    ).toBe(true);
  });
});
