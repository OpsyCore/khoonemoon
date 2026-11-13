import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { handleAssistantPayload } from "./edge-handler";

const client = {} as SupabaseClient;
const context = {
  client,
  userId: "60000000-0000-4000-8000-000000000021",
  householdId: "60000000-0000-4000-8000-000000000022",
  environment: {},
  now: new Date("2026-10-28T12:00:00Z"),
};

describe("assistant edge handler contract", () => {
  it("rejects malformed requests without invoking a data service", async () => {
    const result = await handleAssistantPayload({
      ...context,
      body: { mode: "message", message: "   " },
    });
    expect(result.status).toBe(400);
    expect(result.body.message).toContain("معتبر");
  });

  it("serves a greeting internally when Cloud is off", async () => {
    const result = await handleAssistantPayload({
      ...context,
      body: {
        mode: "message",
        message: "سلام",
        allowCloud: true,
        timeZone: "Asia/Tehran",
      },
      fetcher: vi.fn(),
    });
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      source: "internal",
      status: "internal_active",
      intent: "greeting",
    });
    expect(result.body.text).toContain("دستیار داخلی");
  });

  it("uses the server-allowlisted model when no model override is configured", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          data: [
            {
              id: "nvidia/nemotron-3.5-super-vl:free",
              pricing: { prompt: "0", completion: "0" },
              supported_parameters: ["response_format"],
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          choices: [{ message: { content: '{"intent":"greeting"}' } }],
        }),
      );
    const result = await handleAssistantPayload({
      ...context,
      body: { mode: "message", message: "سلام", allowCloud: true },
      environment: {
        cloudEnabled: "true",
        openRouterApiKey: "server-secret-test",
      },
      fetcher,
    });
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      source: "cloud",
      intent: "greeting",
      status: "cloud_available",
    });
    expect(JSON.parse(String(fetcher.mock.calls[1]?.[1]?.body)).model).toBe(
      "nvidia/nemotron-3.5-super-vl:free",
    );
  });

  it("does not attempt an action if secure signing is not configured", async () => {
    const result = await handleAssistantPayload({
      ...context,
      body: { mode: "confirm", token: "a.b" },
    });
    expect(result.status).toBe(503);
    expect(result.body.message).toContain("تغییری انجام نشد");
  });
});
