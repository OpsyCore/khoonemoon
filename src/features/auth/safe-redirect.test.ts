import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "./safe-redirect";

describe("safe auth redirect", () => {
  it.each([
    null,
    "",
    "https://evil.test",
    "//evil.test",
    "/\\evil.test",
    "javascript:alert(1)",
    "/\nevil",
  ])("rejects %s", (value) => {
    expect(safeRedirectPath(value)).toBe("/today");
  });
  it("keeps a same-origin path and query", () => {
    expect(safeRedirectPath("/home?inviteCode=abc")).toBe(
      "/home?inviteCode=abc",
    );
  });
});
