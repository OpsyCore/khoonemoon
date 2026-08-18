import { describe, expect, it } from "vitest";
import { loginSchema, signupSchema } from "@/features/auth/schemas";

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
});
