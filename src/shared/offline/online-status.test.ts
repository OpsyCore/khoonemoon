import { describe, expect, it } from "vitest";
import {
  getOnlineServerSnapshot,
  offlineUserMessage,
  resolveOfflineRetryHref,
} from "./online-status";

describe("online status helpers", () => {
  it("treats the server snapshot as online", () => {
    expect(getOnlineServerSnapshot()).toBe(true);
  });

  it("returns a Persian offline message", () => {
    expect(offlineUserMessage()).toContain("اتصال اینترنت قطع است");
  });

  it("retries to Today when online and stays on offline when not", () => {
    expect(resolveOfflineRetryHref(true)).toBe("/today");
    expect(resolveOfflineRetryHref(false)).toBe("/offline");
  });
});
