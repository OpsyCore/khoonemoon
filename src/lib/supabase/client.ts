import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv, readSupabaseEnv } from "@/lib/supabase/env";

export const MISSING_SUPABASE_CONFIG_MESSAGE =
  "اتصال به سرور تنظیم نشده است. متغیرهای NEXT_PUBLIC_SUPABASE_URL و " +
  "NEXT_PUBLIC_SUPABASE_ANON_KEY باید پیش از build روی میزبان تنظیم شوند.";

export type BrowserClientConfig =
  { error: string } | { url: string; anonKey: string };

export type BrowserClientResult =
  { client: ReturnType<typeof createBrowserClient> } | { error: string };

/**
 * Returns the Supabase configuration for the browser, or a message explaining
 * why the app cannot talk to the backend yet. Never throws.
 *
 * This exists because `createBrowserClient` used to be called straight from a
 * form handler: when the environment was missing, `getSupabaseEnv()` threw
 * inside an async submit handler, react-hook-form swallowed the rejected
 * promise, and the user saw *nothing at all* — no spinner, no error. Silently
 * doing nothing is the worst possible failure for a login form.
 */
export function readBrowserClientConfig(): BrowserClientConfig {
  const env = readSupabaseEnv();

  if (!env) return { error: MISSING_SUPABASE_CONFIG_MESSAGE };

  return { url: env.url, anonKey: env.anonKey };
}

/** Like `createSupabaseBrowserClient`, but reports a message instead of throwing. */
export function openSupabaseBrowserClient(): BrowserClientResult {
  const config = readBrowserClientConfig();

  if ("error" in config) return { error: config.error };

  return { client: createBrowserClient(config.url, config.anonKey) };
}

export function createSupabaseBrowserClient() {
  const { url, anonKey } = getSupabaseEnv();
  return createBrowserClient(url, anonKey);
}
