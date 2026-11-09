import { describe, expect, it } from "vitest";
import {
  mobileConnectSources,
  mobileRuntimeAttributes,
  validateMobileConfig,
} from "../../../mobile/build-config";

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
  it("places public runtime configuration in escaped HTML attributes", () => {
    expect(
      mobileRuntimeAttributes(
        "https://example.supabase.co",
        'sb_publishable_test&"<>',
      ),
    ).toBe(
      'data-supabase-url="https://example.supabase.co" data-supabase-anon-key="sb_publishable_test&amp;&quot;&lt;&gt;"',
    );
    expect(mobileRuntimeAttributes(undefined, undefined)).toBe("");
  });
  it("restricts CSP connections to the configured origin and secure websocket", () => {
    expect(mobileConnectSources("https://project.supabase.co")).toBe(
      "https://project.supabase.co wss://project.supabase.co",
    );
    expect(mobileConnectSources(undefined)).toBe("");
    expect(() => mobileConnectSources("http://example.com")).toThrow();
    expect(() => mobileConnectSources("https://example.com/path")).toThrow();
  });
});
