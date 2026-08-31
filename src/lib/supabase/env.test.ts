import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getSupabaseEnv } from "./env";

const URL_VAR = "NEXT_PUBLIC_SUPABASE_URL";
const KEY_VAR = "NEXT_PUBLIC_SUPABASE_ANON_KEY";

const VALID_URL = "https://isfzuxrkzeeeggvfcoah.supabase.co";
const VALID_LEGACY_JWT = "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.c2ln";
const VALID_PUBLISHABLE = "sb_publishable_abc123DEF456";

describe("getSupabaseEnv", () => {
  const original = {
    url: process.env[URL_VAR],
    key: process.env[KEY_VAR],
  };

  beforeEach(() => {
    process.env[URL_VAR] = VALID_URL;
    process.env[KEY_VAR] = VALID_LEGACY_JWT;
  });

  afterEach(() => {
    process.env[URL_VAR] = original.url;
    process.env[KEY_VAR] = original.key;
  });

  it("accepts a legacy anon JWT", () => {
    expect(getSupabaseEnv()).toEqual({
      url: VALID_URL,
      anonKey: VALID_LEGACY_JWT,
    });
  });

  it("accepts a modern publishable key", () => {
    process.env[KEY_VAR] = VALID_PUBLISHABLE;
    expect(getSupabaseEnv().anonKey).toBe(VALID_PUBLISHABLE);
  });

  it("trims whitespace and strips accidental quotes", () => {
    process.env[URL_VAR] = `  "${VALID_URL}"  `;
    process.env[KEY_VAR] = ` '${VALID_PUBLISHABLE}' `;
    expect(getSupabaseEnv()).toEqual({
      url: VALID_URL,
      anonKey: VALID_PUBLISHABLE,
    });
  });

  it("normalizes a trailing slash on the URL", () => {
    process.env[URL_VAR] = `${VALID_URL}/`;
    expect(getSupabaseEnv().url).toBe(VALID_URL);
  });

  it("throws when variables are missing", () => {
    delete process.env[URL_VAR];
    expect(() => getSupabaseEnv()).toThrow(/not configured/);
  });

  it("rejects a Markdown-link URL like [https://x](https://x)", () => {
    process.env[URL_VAR] = `[${VALID_URL}](${VALID_URL})`;
    expect(() => getSupabaseEnv()).toThrow(/square brackets/);
  });

  it("rejects a key containing backslash-escaped underscores", () => {
    process.env[KEY_VAR] = "sb\\_publishable\\_abc123";
    expect(() => getSupabaseEnv()).toThrow(/backslash-escaped/);
  });

  it("rejects a key with internal whitespace", () => {
    process.env[KEY_VAR] = "eyJhbGciOi JIUzI1NiJ9.eyJ4IjoxfQ.c2ln";
    expect(() => getSupabaseEnv()).toThrow(/whitespace/);
  });

  it("rejects a secret key in the browser variable", () => {
    process.env[KEY_VAR] = "sb_secret_abc123";
    expect(() => getSupabaseEnv()).toThrow(/secret key/);
  });

  it("rejects values that are not Supabase keys at all", () => {
    process.env[KEY_VAR] = "hello-world";
    expect(() => getSupabaseEnv()).toThrow(/does not look like a valid/);
  });

  it("never leaks the key value in error messages", () => {
    const bogus = "sb\\_publishable\\_SUPERSECRETVALUE";
    process.env[KEY_VAR] = bogus;
    try {
      getSupabaseEnv();
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(String(error)).not.toContain("SUPERSECRETVALUE");
    }
  });
});
