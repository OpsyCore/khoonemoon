import { describe, expect, it } from "vitest";
import { CHORE_SECURITY_NOTES } from "./security";

describe("chores security model", () => {
  it("documents that all chores are household-shared in MVP", () => {
    expect(CHORE_SECURITY_NOTES.allShared).toBe(true);
  });

  it("documents that household membership is required for access", () => {
    expect(CHORE_SECURITY_NOTES.requiresHouseholdMembership).toBe(true);
  });

  it("documents that completions are unique per chore/date", () => {
    expect(CHORE_SECURITY_NOTES.completionUniquePerDate).toBe(true);
  });

  it("documents immutable fields", () => {
    expect(CHORE_SECURITY_NOTES.immutableFields).toContain("household_id");
    expect(CHORE_SECURITY_NOTES.immutableFields).toContain("created_by");
  });
});
