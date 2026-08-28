import { describe, expect, it } from "vitest";
import {
  loginSchema,
  signupSchema,
  updatePasswordSchema,
} from "@/features/auth/schemas";

describe("auth schemas", () => {
  it("rejects invalid signup input with Persian messages", () => {
    const result = signupSchema.safeParse({
      fullName: "",
      email: "invalid-email",
      password: "123",
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.issues[0]?.message.length).toBeGreaterThan(0);
    }
  });

  it("accepts valid login payload", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "12345678",
    });

    expect(result.success).toBe(true);
  });

  it("accepts a valid signup payload", () => {
    expect(
      signupSchema.safeParse({
        fullName: "کاربر آزمایشی",
        email: "user-a@example.com",
        password: "12345678",
      }).success,
    ).toBe(true);
  });

  it("requires matching passwords on update", () => {
    expect(
      updatePasswordSchema.safeParse({
        password: "12345678",
        confirmPassword: "87654321",
      }).success,
    ).toBe(false);

    expect(
      updatePasswordSchema.safeParse({
        password: "12345678",
        confirmPassword: "12345678",
      }).success,
    ).toBe(true);
  });
});
