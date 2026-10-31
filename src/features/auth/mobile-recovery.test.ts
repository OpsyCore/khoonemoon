import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ANDROID_RECOVERY_REDIRECT,
  changeRecoveredPassword,
  requestRecovery,
} from "../../../mobile/src/recovery";

function fixture() {
  const resetPasswordForEmail = vi.fn().mockResolvedValue({ error: null });
  const updateUser = vi.fn().mockResolvedValue({ error: null });
  return {
    resetPasswordForEmail,
    updateUser,
    client: {
      auth: { resetPasswordForEmail, updateUser },
    } as unknown as SupabaseClient,
  };
}
describe("mobile password recovery", () => {
  it("requests a recovery link to the Android callback with a trimmed email", async () => {
    const { client, resetPasswordForEmail } = fixture();
    await requestRecovery(
      client,
      " user@example.com ",
      ANDROID_RECOVERY_REDIRECT,
    );
    expect(resetPasswordForEmail).toHaveBeenCalledWith("user@example.com", {
      redirectTo: "app.khoonemoon.mobile://recovery",
    });
  });
  it("rejects invalid email before sending", async () => {
    const { client, resetPasswordForEmail } = fixture();
    await expect(
      requestRecovery(client, "invalid", ANDROID_RECOVERY_REDIRECT),
    ).rejects.toThrow();
    expect(resetPasswordForEmail).not.toHaveBeenCalled();
  });
  it("checks confirmation and minimum length before changing password", async () => {
    const { client, updateUser } = fixture();
    await expect(
      changeRecoveredPassword(client, "12345678", "different"),
    ).rejects.toThrow();
    await expect(
      changeRecoveredPassword(client, "short", "short"),
    ).rejects.toThrow();
    expect(updateUser).not.toHaveBeenCalled();
    await changeRecoveredPassword(client, "12345678", "12345678");
    expect(updateUser).toHaveBeenCalledWith({ password: "12345678" });
  });
  it("propagates provider errors", async () => {
    const { client, resetPasswordForEmail, updateUser } = fixture();
    resetPasswordForEmail.mockResolvedValue({ error: new Error("failed") });
    updateUser.mockResolvedValue({ error: new Error("failed") });
    await expect(
      requestRecovery(client, "user@example.com", ANDROID_RECOVERY_REDIRECT),
    ).rejects.toThrow();
    await expect(
      changeRecoveredPassword(client, "12345678", "12345678"),
    ).rejects.toThrow();
  });
});
