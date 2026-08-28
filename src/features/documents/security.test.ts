import { describe, expect, it } from "vitest";
import {
  canAccessDocument,
  documentStoragePrefix,
  isDocumentStoragePathAllowed,
  isValidDocumentVisibilityPairing,
} from "@/features/documents/security";

describe("document access", () => {
  it("keeps PRIVATE documents owner-only even in the same household", () => {
    expect(
      canAccessDocument({
        viewerId: "user-b",
        createdBy: "user-a",
        visibility: "PRIVATE",
        householdId: null,
        viewerHouseholdId: "h1",
      }),
    ).toBe(false);

    expect(
      canAccessDocument({
        viewerId: "user-a",
        createdBy: "user-a",
        visibility: "PRIVATE",
        householdId: null,
        viewerHouseholdId: "h1",
      }),
    ).toBe(true);
  });

  it("allows SHARED documents only inside the same household", () => {
    expect(
      canAccessDocument({
        viewerId: "user-b",
        createdBy: "user-a",
        visibility: "HOUSEHOLD_SHARED",
        householdId: "h1",
        viewerHouseholdId: "h1",
      }),
    ).toBe(true);

    expect(
      canAccessDocument({
        viewerId: "user-c",
        createdBy: "user-a",
        visibility: "HOUSEHOLD_SHARED",
        householdId: "h1",
        viewerHouseholdId: "h2",
      }),
    ).toBe(false);
  });

  it("rejects invalid visibility/household pairing", () => {
    expect(
      isValidDocumentVisibilityPairing({
        visibility: "PRIVATE",
        householdId: "h1",
      }),
    ).toBe(false);
    expect(
      isValidDocumentVisibilityPairing({
        visibility: "HOUSEHOLD_SHARED",
        householdId: null,
      }),
    ).toBe(false);
  });

  it("builds storage prefixes that cannot escape the owner folder", () => {
    expect(
      documentStoragePrefix({
        visibility: "PRIVATE",
        userId: "user-a",
        householdId: null,
      }),
    ).toBe("user/user-a");

    expect(
      isDocumentStoragePathAllowed({
        storagePath: "user/user-a/doc/file.pdf",
        visibility: "PRIVATE",
        userId: "user-a",
        householdId: null,
      }),
    ).toBe(true);

    expect(
      isDocumentStoragePathAllowed({
        storagePath: "user/user-b/doc/file.pdf",
        visibility: "PRIVATE",
        userId: "user-a",
        householdId: null,
      }),
    ).toBe(false);
  });
});
