import { describe, expect, it } from "vitest";
import { isGuestOnlyAuthPath, isProtectedPath } from "@/proxy";

describe("app path protection", () => {
  it("protects app shell routes including finance", () => {
    expect(isProtectedPath("/today")).toBe(true);
    expect(isProtectedPath("/calendar")).toBe(true);
    expect(isProtectedPath("/home")).toBe(true);
    expect(isProtectedPath("/lists")).toBe(true);
    expect(isProtectedPath("/profile")).toBe(true);
    expect(isProtectedPath("/settings")).toBe(true);
    expect(isProtectedPath("/search")).toBe(true);
    expect(isProtectedPath("/finance")).toBe(true);
    expect(isProtectedPath("/finance/extra")).toBe(true);
    expect(isProtectedPath("/documents")).toBe(true);
    expect(isProtectedPath("/documents/extra")).toBe(true);
  });

  it("does not treat public or API routes as page-middleware protected", () => {
    expect(isProtectedPath("/offline")).toBe(false);
    expect(isProtectedPath("/auth/login")).toBe(false);
    expect(isProtectedPath("/api/finance")).toBe(false);
    expect(isProtectedPath("/api/tasks")).toBe(false);
  });

  it("marks login/signup/forgot-password as guest-only", () => {
    expect(isGuestOnlyAuthPath("/auth/login")).toBe(true);
    expect(isGuestOnlyAuthPath("/auth/signup")).toBe(true);
    expect(isGuestOnlyAuthPath("/auth/forgot-password")).toBe(true);
    expect(isGuestOnlyAuthPath("/auth/update-password")).toBe(false);
  });
});
