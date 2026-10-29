import { afterEach, describe, expect, it, vi } from "vitest";

import {
  MISSING_SUPABASE_CONFIG_MESSAGE,
  openSupabaseBrowserClient,
  readBrowserClientConfig,
} from "./client";

afterEach(() => {
  vi.unstubAllEnvs();
});

function clearEnv() {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
}

describe("readBrowserClientConfig", () => {
  it("reports a message instead of throwing when the backend is not configured", () => {
    clearEnv();

    expect(readBrowserClientConfig()).toEqual({
      error: MISSING_SUPABASE_CONFIG_MESSAGE,
    });
  });

  it("treats a half-configured environment as unconfigured", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");

    expect(readBrowserClientConfig()).toEqual({
      error: MISSING_SUPABASE_CONFIG_MESSAGE,
    });
  });

  it("returns the configuration when both values are present", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");

    expect(readBrowserClientConfig()).toEqual({
      url: "https://example.supabase.co",
      anonKey: "anon-key",
    });
  });
});

describe("openSupabaseBrowserClient", () => {
  // The regression this guards: a form handler called the throwing variant, the
  // rejected promise was swallowed by react-hook-form, and pressing «ثبت‌نام»
  // did nothing at all — no error, no loading state. Users reported a dead form.
  it("hands back an error message rather than throwing, so a form can show it", () => {
    clearEnv();

    const opened = openSupabaseBrowserClient();

    expect("error" in opened).toBe(true);
    expect(opened).toEqual({ error: MISSING_SUPABASE_CONFIG_MESSAGE });
  });

  it("does not leave the user staring at an untranslated English exception", () => {
    clearEnv();

    const message = MISSING_SUPABASE_CONFIG_MESSAGE;

    expect(message).toMatch(/[\u0600-\u06FF]/);
    expect(message).toContain("NEXT_PUBLIC_SUPABASE_URL");
    expect(message).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  });
});
