import type { SupabaseClient } from "@supabase/supabase-js";
import {
  forgotPasswordSchema,
  updatePasswordSchema,
} from "@/features/auth/schemas";

export const ANDROID_RECOVERY_REDIRECT = "app.khoonemoon.mobile://recovery";

/** PKCE requires the link to be opened in the same app/browser which requested it. */
export async function requestRecovery(
  client: SupabaseClient,
  email: string,
  redirectTo: string,
) {
  const input = forgotPasswordSchema.parse({ email });
  const { error } = await client.auth.resetPasswordForEmail(input.email, {
    redirectTo,
  });
  if (error) throw error;
}
export async function changeRecoveredPassword(
  client: SupabaseClient,
  password: string,
  confirmPassword: string,
) {
  const input = updatePasswordSchema.parse({ password, confirmPassword });
  const { error } = await client.auth.updateUser({ password: input.password });
  if (error) throw error;
}
