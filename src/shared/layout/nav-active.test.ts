import { describe, expect, it } from "vitest";
import { isBottomNavActive } from "./nav-active";

describe("isBottomNavActive", () => {
  it("keeps five primary tabs and treats /finance as part of Home", () => {
    expect(isBottomNavActive("/finance", "/home")).toBe(true);
    expect(isBottomNavActive("/finance", "/today")).toBe(false);
    expect(isBottomNavActive("/finance", "/lists")).toBe(false);
    expect(isBottomNavActive("/home", "/home")).toBe(true);
    expect(isBottomNavActive("/today", "/today")).toBe(true);
    expect(isBottomNavActive("/lists", "/home")).toBe(false);
  });

  it("treats /settings as part of Profile without a sixth tab", () => {
    expect(isBottomNavActive("/settings", "/profile")).toBe(true);
    expect(isBottomNavActive("/settings", "/home")).toBe(false);
    expect(isBottomNavActive("/search", "/profile")).toBe(false);
    expect(isBottomNavActive("/search", "/home")).toBe(false);
    expect(isBottomNavActive("/search", "/today")).toBe(false);
    expect(isBottomNavActive("/search", "/lists")).toBe(false);
    expect(isBottomNavActive("/search", "/calendar")).toBe(false);
  });
});
