import { describe, expect, it } from "vitest";
import { buildStoragePath } from "@/features/documents/server";

describe("document storage paths", () => {
  it("keeps PRIVATE files under the user prefix", () => {
    expect(
      buildStoragePath({
        visibility: "PRIVATE",
        userId: "user-a",
        householdId: null,
        documentId: "doc-1",
        fileName: "My Bill.pdf",
      }),
    ).toBe("user/user-a/doc-1/My_Bill.pdf");
  });

  it("keeps SHARED files under the household prefix", () => {
    expect(
      buildStoragePath({
        visibility: "HOUSEHOLD_SHARED",
        userId: "user-a",
        householdId: "h1",
        documentId: "doc-1",
        fileName: "../secret.png",
      }),
    ).toBe("household/h1/doc-1/.._secret.png");
  });
});
