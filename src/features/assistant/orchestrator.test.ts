import { describe, expect, it, vi } from "vitest";
import { orchestrateAssistant } from "./orchestrator";

describe("assistant provider orchestration", () => {
  it("does not call Cloud without explicit per-request consent", async () => {
    const classifyCloud = vi.fn();
    const runInternal = vi.fn(async (parsed) => ({
      intent: parsed.intent,
      text: "پاسخ داخلی",
    }));
    const result = await orchestrateAssistant({
      message: "کارهای امروز؟",
      allowCloud: false,
      classifyCloud,
      runInternal,
    });
    expect(classifyCloud).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      source: "internal",
      status: "internal_active",
      cloudStatus: "cloud_model_disabled",
      intent: "today_tasks",
      text: "پاسخ داخلی",
    });
  });

  it.each([
    "cloud_rate_limited",
    "cloud_timeout",
    "cloud_unavailable",
    "cloud_model_disabled",
  ] as const)("uses internal rules when Cloud reports %s", async (status) => {
    const result = await orchestrateAssistant({
      message: "لیست خرید را نشان بده",
      allowCloud: true,
      classifyCloud: async () => ({ intent: "unknown", status }),
      runInternal: async (parsed) => ({
        intent: parsed.intent,
        text: "لیست داخلی",
      }),
    });
    expect(result).toMatchObject({
      source: "internal",
      status: "internal_active",
      cloudStatus: status,
      intent: "shopping_list",
      text: "لیست داخلی",
    });
  });

  it("uses Cloud only to select an allowlisted intent; data response remains local", async () => {
    const result = await orchestrateAssistant({
      message: "please show my tasks today",
      allowCloud: true,
      classifyCloud: async () => ({
        intent: "today_tasks",
        status: "cloud_available",
      }),
      runInternal: async (parsed, context) => ({
        intent: parsed.intent,
        text: `local:${context.source}`,
      }),
    });
    expect(result).toMatchObject({
      source: "cloud",
      status: "cloud_available",
      intent: "today_tasks",
      text: "local:cloud",
    });
  });

  it("recovers to the internal router when the provider throws", async () => {
    const result = await orchestrateAssistant({
      message: "کدام قبض‌ها نزدیکند؟",
      allowCloud: true,
      classifyCloud: async () => {
        throw new Error("provider error");
      },
      runInternal: async (parsed) => ({
        intent: parsed.intent,
        text: "از دادهٔ خانه",
      }),
    });
    expect(result).toMatchObject({
      source: "internal",
      status: "internal_active",
      cloudStatus: "cloud_unavailable",
      intent: "upcoming_bills",
    });
  });
});
