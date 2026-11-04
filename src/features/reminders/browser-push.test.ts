// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  decodeApplicationKey,
  isMozillaPushEndpoint,
  enableBrowserPush,
  disableBrowserPush,
} from "../../../mobile/src/web-push";

const key = `B${"A".repeat(86)}`;
function setup(
  endpoint = "https://updates.push.services.mozilla.com/wpush/v2/device",
) {
  Object.defineProperty(globalThis, "Notification", {
    configurable: true,
    value: { permission: "granted", requestPermission: vi.fn() },
  });
  const sub = {
    endpoint,
    options: { applicationServerKey: decodeApplicationKey(key).buffer },
    toJSON: () => ({ keys: { p256dh: "public", auth: "auth" } }),
    unsubscribe: vi.fn().mockResolvedValue(true),
  };
  const manager = {
    getSubscription: vi.fn().mockResolvedValue(null),
    subscribe: vi.fn().mockResolvedValue(sub),
  };
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const eq2 = vi.fn().mockResolvedValue({ error: null });
  const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
  const update = vi.fn().mockReturnValue({ eq: eq1 });
  const client = {
    auth: {
      getUser: vi
        .fn()
        .mockResolvedValue({ data: { user: { id: "account" } }, error: null }),
    },
    from: vi.fn().mockReturnValue({ upsert, update }),
  } as unknown as SupabaseClient;
  const registration = {
    pushManager: manager,
  } as unknown as ServiceWorkerRegistration;
  return { sub, manager, upsert, client, registration, eq1, eq2 };
}
describe("standalone browser push", () => {
  it("accepts only the HTTPS Mozilla gateway", () => {
    expect(
      isMozillaPushEndpoint(
        "https://updates.push.services.mozilla.com/wpush/v2/abc",
      ),
    ).toBe(true);
    for (const url of [
      "https://fcm.googleapis.com/x",
      "https://updates.push.services.mozilla.com.evil.test/x",
      "http://push.services.mozilla.com/x",
      "https://push.services.mozilla.com:444/x",
    ])
      expect(isMozillaPushEndpoint(url)).toBe(false);
  });
  it("rejects malformed application keys", () => {
    expect(() => decodeApplicationKey("not valid")).toThrow();
    expect(() => decodeApplicationKey("abc")).toThrow();
  });
  it("registers only the current account and enables its preference", async () => {
    const { client, registration, upsert } = setup();
    await enableBrowserPush(client, registration, key);
    expect(upsert).toHaveBeenCalledTimes(2);
    expect(upsert.mock.calls[0][0]).toMatchObject({
      user_id: "account",
      revoked_at: null,
    });
    expect(upsert.mock.calls[1][0]).toEqual({
      user_id: "account",
      web_push_enabled: true,
    });
  });
  it("unsubscribes a new Firebase subscription without saving it", async () => {
    const { client, registration, sub, upsert } = setup(
      "https://fcm.googleapis.com/device",
    );
    await expect(enableBrowserPush(client, registration, key)).rejects.toThrow(
      "Firebase",
    );
    expect(sub.unsubscribe).toHaveBeenCalledOnce();
    expect(upsert).not.toHaveBeenCalled();
  });
  it("revokes only the current account and endpoint before unsubscribing", async () => {
    const { client, registration, manager, sub, eq1, eq2 } = setup();
    manager.getSubscription.mockResolvedValue(sub);
    await disableBrowserPush(client, registration);
    expect(eq1).toHaveBeenCalledWith("user_id", "account");
    expect(eq2).toHaveBeenCalledWith("endpoint", sub.endpoint);
    expect(sub.unsubscribe).toHaveBeenCalledOnce();
  });
  it("unsubscribes locally even if server revocation fails", async () => {
    const { client, registration, manager, sub, eq2 } = setup();
    manager.getSubscription.mockResolvedValue(sub);
    eq2.mockRejectedValue(new Error("offline"));
    await expect(disableBrowserPush(client, registration)).rejects.toThrow(
      "لغو سرور",
    );
    expect(sub.unsubscribe).toHaveBeenCalledOnce();
  });
});
