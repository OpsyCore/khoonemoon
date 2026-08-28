import { describe, expect, it } from "vitest";
import {
  cancelInvitationSchema,
  createHouseholdSchema,
  joinHouseholdSchema,
  updateHouseholdSchema,
} from "@/features/households/schemas";

describe("household schemas", () => {
  it("accepts a valid household name", () => {
    expect(createHouseholdSchema.safeParse({ name: "خونه ما" }).success).toBe(
      true,
    );
    expect(updateHouseholdSchema.safeParse({ name: "خونه ما" }).success).toBe(
      true,
    );
  });

  it("rejects a too-short household name", () => {
    expect(createHouseholdSchema.safeParse({ name: "خ" }).success).toBe(false);
  });

  it("rejects a short invitation code", () => {
    expect(joinHouseholdSchema.safeParse({ code: "short" }).success).toBe(
      false,
    );
    expect(
      joinHouseholdSchema.safeParse({ code: "abcdefghijkl" }).success,
    ).toBe(true);
  });

  it("requires a uuid invitation id to cancel", () => {
    expect(
      cancelInvitationSchema.safeParse({ invitationId: "not-a-uuid" }).success,
    ).toBe(false);
    expect(
      cancelInvitationSchema.safeParse({
        invitationId: "11111111-1111-4111-8111-111111111111",
      }).success,
    ).toBe(true);
  });
});
