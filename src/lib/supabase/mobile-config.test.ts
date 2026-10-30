import { describe, expect, it } from "vitest";
import { validateMobileConfig } from "../../../mobile/build-config";

function token(role: string) {
  return `header.${Buffer.from(JSON.stringify({ role })).toString("base64url")}.signature`;
}

describe("mobile client build configuration", () => {
  it("accepts only publishable and legacy anon keys", () => {
    expect(() =>
      validateMobileConfig(
        "https://example.supabase.co",
        "sb_publishable_example",
      ),
    ).not.toThrow();
    expect(() =>
      validateMobileConfig("https://example.supabase.co", token("anon")),
    ).not.toThrow();
    expect(() =>
      validateMobileConfig("https://example.supabase.co", "sb_secret_example"),
    ).toThrow();
    expect(() =>
      validateMobileConfig(
        "https://example.supabase.co",
        token("service_role"),
      ),
    ).toThrow();
  });
  it("rejects missing values and non-HTTPS or decorated origins", () => {
    for (const url of [
      undefined,
      "http://example.com",
      "https://u:p@example.com",
      "https://example.com/path",
      "https://example.com/?key=1",
    ]) {
      expect(() =>
        validateMobileConfig(url, "sb_publishable_example"),
      ).toThrow();
    }
    expect(() =>
      validateMobileConfig("https://example.com", undefined),
    ).toThrow();
  });
});
