import { describe, expect, it } from "vitest";
import {
  getAuthCallbackErrorCode,
  getPersianAuthErrorMessage,
} from "@/features/auth/error-messages";

describe("auth error messages", () => {
  it("maps unconfirmed email error", () => {
    const message = getPersianAuthErrorMessage({
      message: "Email not confirmed",
    });

    expect(message).toContain("تایید نشده");
  });

  it("maps invalid credentials error", () => {
    const message = getPersianAuthErrorMessage({
      message: "Invalid login credentials",
    });

    expect(message).toContain("نادرست");
  });

  it("maps already registered error", () => {
    const message = getPersianAuthErrorMessage({
      message: "User already registered",
    });

    expect(message).toContain("قبلاً ثبت");
  });

  it("maps callback expired error code", () => {
    const code = getAuthCallbackErrorCode({
      message: "OTP expired",
    });

    expect(code).toBe("auth_callback_expired_or_invalid");
  });

  it("keeps unknown errors generic", () => {
    const message = getPersianAuthErrorMessage({
      message: "some_internal_code",
    });
    expect(message).toContain("عملیات احراز هویت");
  });
});
