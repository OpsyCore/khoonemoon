import { createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import {
  directHousehold,
  generateInvitationCodeBrowser,
  hashInvitationCodeBrowser,
} from "./direct-client";

function setup() {
  const fetcher = vi.fn(
    async (_url: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify("house-1"), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
  );
  const client = createClient(
    "https://example.supabase.co",
    "public-anon-key",
    {
      global: { fetch: fetcher },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  return { api: directHousehold(client), fetcher };
}

describe("direct household transport", () => {
  it("matches the existing server hash and generates 24-byte URL-safe codes", async () => {
    const code = generateInvitationCodeBrowser();
    expect(code).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(await hashInvitationCodeBrowser(code)).toBe(
      createHash("sha256").update(code).digest("hex"),
    );
  });
  it("sends only the hash when joining a house", async () => {
    const { api, fetcher } = setup();
    const code = "  example-invitation-code  ";
    await expect(api.join(code)).resolves.toBe("house-1");
    const [url, init] = fetcher.mock.calls[0];
    expect(String(url)).toContain("join_household_with_invitation");
    expect(JSON.parse(String(init?.body))).toEqual({
      p_code_hash: createHash("sha256").update(code.trim()).digest("hex"),
    });
    expect(String(init?.body)).not.toContain(code.trim());
  });
  it("validates before creating and sends normalized names", async () => {
    const { api, fetcher } = setup();
    await expect(api.create("x")).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
    await api.create("  خانهٔ ما  ");
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual({
      p_name: "خانهٔ ما",
    });
  });
  it("only sends the invite hash, never the invitation code", async () => {
    const { api, fetcher } = setup();
    const invite = await api.invite();
    const body = JSON.parse(String(fetcher.mock.calls[0][1]?.body));
    expect(body.p_code_hash).toBe(
      createHash("sha256").update(invite.code).digest("hex"),
    );
    expect(body.p_expires_at).toBe(invite.expiresAt);
    expect(String(fetcher.mock.calls[0][1]?.body)).not.toContain(invite.code);
  });
});
