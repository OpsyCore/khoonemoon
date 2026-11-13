import { describe, expect, it, vi } from "vitest";
import { classifyWithOpenRouter, VERIFIED_FREE_MODEL_IDS } from "./cloud";

const approved = ["nvidia/nemotron-3.5-super-vl:free"];
const model = (prompt: unknown = "0", completion: unknown = "0") =>
  Response.json({
    data: [
      {
        id: "nvidia/nemotron-3.5-super-vl:free",
        pricing: { prompt, completion },
        supported_parameters: ["response_format"],
      },
    ],
  });
const completion = (content: string) =>
  Response.json({ choices: [{ message: { content } }] });

function configuration(
  fetcher: typeof fetch,
  extra: Record<string, unknown> = {},
) {
  return classifyWithOpenRouter({
    message: "کارهای امروز من؟",
    enabled: true,
    apiKey: "server-secret-test",
    modelId: approved[0],
    approvedModelIds: approved,
    fetcher,
    ...extra,
  });
}

describe("optional strictly-free OpenRouter classifier", () => {
  it("pins the user-verified NVIDIA model by its exact free route ID", () => {
    expect(VERIFIED_FREE_MODEL_IDS).toEqual([
      "nvidia/nemotron-3.5-super-vl:free",
    ]);
  });

  it("uses the default exact allowlist when runtime pricing remains zero", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(model())
      .mockResolvedValueOnce(completion('{"intent":"today_tasks"}'));
    const result = await classifyWithOpenRouter({
      message: "کارهای امروز من؟",
      enabled: true,
      apiKey: "server-secret-test",
      modelId: VERIFIED_FREE_MODEL_IDS[0],
      fetcher,
    });
    expect(result).toEqual({
      intent: "today_tasks",
      status: "cloud_available",
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("uses an approved zero-price model for JSON intent only", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(model())
      .mockResolvedValueOnce(completion('{"intent":"today_tasks"}'));
    const result = await configuration(fetcher);
    expect(result).toEqual({
      intent: "today_tasks",
      status: "cloud_available",
    });
    const body = JSON.parse(String(fetcher.mock.calls[1]?.[1]?.body));
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.messages[1].content).toBe("کارهای امروز من؟");
    expect(body.messages[1].content).not.toContain("خانه");
  });

  it("never calls inference for a model with paid or unknown price", async () => {
    const paidFetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(model("0.00001", "0"));
    expect(await configuration(paidFetcher)).toEqual({
      intent: "unknown",
      status: "cloud_model_disabled",
    });
    expect(paidFetcher).toHaveBeenCalledTimes(1);

    const unknownFetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(
      Response.json({
        data: [
          {
            id: "nvidia/nemotron-3.5-super-vl:free",
            pricing: { completion: "0" },
            supported_parameters: ["response_format"],
          },
        ],
      }),
    );
    expect(await configuration(unknownFetcher)).toMatchObject({
      status: "cloud_model_disabled",
    });
    expect(unknownFetcher).toHaveBeenCalledTimes(1);
  });

  it("keeps Cloud disabled without an exact allowlist entry", async () => {
    const fetcher = vi.fn<typeof fetch>();
    expect(
      await classifyWithOpenRouter({
        message: "سلام",
        enabled: true,
        apiKey: "server-secret-test",
        modelId: "vendor/unknown:free",
        fetcher,
      }),
    ).toEqual({ intent: "unknown", status: "cloud_model_disabled" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("falls back cleanly on rate limits and malformed model output", async () => {
    const limited = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(model())
      .mockResolvedValueOnce(new Response(null, { status: 429 }));
    expect(await configuration(limited)).toMatchObject({
      status: "cloud_rate_limited",
    });

    const malformed = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(model())
      .mockResolvedValueOnce(completion("not json"));
    expect(await configuration(malformed)).toMatchObject({
      status: "cloud_unavailable",
    });
  });

  it("bounds retries on transient provider failures", async () => {
    const unavailable = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(model())
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 503 }));
    expect(await configuration(unavailable)).toMatchObject({
      status: "cloud_unavailable",
    });
    expect(unavailable).toHaveBeenCalledTimes(3);

    const timeout = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(
        Object.assign(new Error("timeout"), { name: "TimeoutError" }),
      );
    expect(await configuration(timeout)).toMatchObject({
      status: "cloud_timeout",
    });
  });
});
