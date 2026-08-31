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

import { getSupabaseConfigDebugText, getSupabaseKeyDiagnostics } from "./env";

// A syntactically valid legacy JWT whose payload is
// {"iss":"supabase","ref":"isfzuxrkzeeeggvfcoah","role":"anon","exp":4102444800}
const JWT_MATCHING_REF =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." +
  Buffer.from(
    JSON.stringify({
      iss: "supabase",
      ref: "isfzuxrkzeeeggvfcoah",
      role: "anon",
      exp: 4102444800,
    }),
  )
    .toString("base64")
    .replace(/=+$/, "") +
  ".c2lnbmF0dXJl";

const JWT_OTHER_REF =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." +
  Buffer.from(
    JSON.stringify({
      iss: "supabase",
      ref: "someotherproject",
      role: "anon",
      exp: 1,
    }),
  )
    .toString("base64")
    .replace(/=+$/, "") +
  ".c2lnbmF0dXJl";

describe("getSupabaseKeyDiagnostics", () => {
  it("fingerprints a publishable key without exposing it", () => {
    const d = getSupabaseKeyDiagnostics("sb_publishable_abc123DEF456xyz");
    expect(d.keyType).toBe("publishable");
    expect(d.keyLength).toBe(30);
    expect(d.keyPrefix).toBe("sb_publi");
    expect(d.hasMarkdownArtifacts).toBe(false);
    expect(d.jwtProjectRef).toBeNull();
  });

  it("decodes public claims from a legacy JWT", () => {
    const d = getSupabaseKeyDiagnostics(JWT_MATCHING_REF);
    expect(d.keyType).toBe("legacy-jwt");
    expect(d.keyPrefix).toBe("eyJhbGci");
    expect(d.jwtProjectRef).toBe("isfzuxrkzeeeggvfcoah");
    expect(d.jwtRole).toBe("anon");
    expect(d.jwtExpiresAt).toBe("2100-01-01T00:00:00.000Z");
  });

  it("flags markdown artifacts", () => {
    const d = getSupabaseKeyDiagnostics("sb\\_publishable\\_abc");
    expect(d.hasMarkdownArtifacts).toBe(true);
  });
});

describe("getSupabaseConfigDebugText", () => {
  const URL_VAR = "NEXT_PUBLIC_SUPABASE_URL";
  const KEY_VAR = "NEXT_PUBLIC_SUPABASE_ANON_KEY";
  const original = { url: process.env[URL_VAR], key: process.env[KEY_VAR] };

  afterEach(() => {
    process.env[URL_VAR] = original.url;
    process.env[KEY_VAR] = original.key;
  });

  it("reports url, key type and fingerprint without the key value", () => {
    process.env[URL_VAR] = "https://isfzuxrkzeeeggvfcoah.supabase.co";
    process.env[KEY_VAR] = JWT_MATCHING_REF;
    const text = getSupabaseConfigDebugText();
    expect(text).toContain("url=https://isfzuxrkzeeeggvfcoah.supabase.co");
    expect(text).toContain("keyType=legacy-jwt");
    expect(text).toContain("jwtRef=isfzuxrkzeeeggvfcoah");
    expect(text).not.toContain("MISMATCH");
    expect(text).not.toContain(JWT_MATCHING_REF);
  });

  it("detects a key that belongs to a different project and an expired key", () => {
    process.env[URL_VAR] = "https://isfzuxrkzeeeggvfcoah.supabase.co";
    process.env[KEY_VAR] = JWT_OTHER_REF;
    const text = getSupabaseConfigDebugText();
    expect(text).toContain("MISMATCH: key belongs to project someotherproject");
    expect(text).toContain("EXPIRED");
  });

  it("reports missing configuration", () => {
    delete process.env[URL_VAR];
    delete process.env[KEY_VAR];
    expect(getSupabaseConfigDebugText()).toContain("missing NEXT_PUBLIC");
  });
});
