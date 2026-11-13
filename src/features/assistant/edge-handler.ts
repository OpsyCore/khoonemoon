import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { verifyAssistantAction } from "./actions";
import { classifyWithOpenRouter, VERIFIED_FREE_MODEL_IDS } from "./cloud";
import { assistantEngineStatusSchema, assistantIntentSchema } from "./core";
import { orchestrateAssistant } from "./orchestrator";
import { executeAssistantAction, runAssistantTool } from "./tools";

const requestSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("message"),
    message: z.string().trim().min(1).max(2000),
    allowCloud: z.boolean().default(false),
    timeZone: z.string().max(80).default("Asia/Tehran"),
  }),
  z.object({
    mode: z.literal("confirm"),
    token: z.string().min(1).max(12000),
    timeZone: z.string().max(80).default("Asia/Tehran"),
  }),
]);

export type AssistantEdgeEnvironment = {
  cloudEnabled?: string;
  openRouterApiKey?: string;
  openRouterModelId?: string;
  actionSigningSecret?: string;
};

export async function handleAssistantPayload({
  body,
  client,
  userId,
  householdId,
  environment,
  fetcher,
  now = new Date(),
}: {
  body: unknown;
  client: SupabaseClient;
  userId: string;
  householdId: string | null;
  environment: AssistantEdgeEnvironment;
  fetcher?: typeof fetch;
  now?: Date;
}): Promise<{ status: number; body: Record<string, unknown> }> {
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success)
    return {
      status: 400,
      body: { message: "پیام معتبر نیست؛ کوتاه‌تر و روشن‌تر بنویس." },
    };

  if (parsed.data.mode === "confirm") {
    if (
      !environment.actionSigningSecret ||
      environment.actionSigningSecret.length < 32
    )
      return {
        status: 503,
        body: {
          message: "تأیید امن عملیات فعلاً در دسترس نیست؛ تغییری انجام نشد.",
        },
      };
    try {
      const claims = await verifyAssistantAction(
        parsed.data.token,
        environment.actionSigningSecret,
        { userId, householdId },
        now.getTime(),
      );
      const result = await executeAssistantAction(
        claims.action,
        claims.requestId,
        {
          client,
          userId,
          householdId,
          timeZone: parsed.data.timeZone,
          message: "",
          now,
          actionSecret: environment.actionSigningSecret,
        },
      );
      return {
        status: 200,
        body: {
          source: "internal",
          status: "internal_active",
          intent: claims.action.type,
          text: result.text,
        },
      };
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      const status = code === "ACTION_CONTEXT_CHANGED" ? 409 : 400;
      return {
        status,
        body: {
          message:
            code === "ACTION_TOKEN_EXPIRED"
              ? "زمان تأیید تمام شد؛ درخواست را دوباره بفرست تا جزئیات تازه بررسی شود."
              : code === "ACTION_CONTEXT_CHANGED"
                ? "خانه یا دسترسی تغییر کرده است؛ برای امنیت، هیچ تغییری انجام نشد. درخواست را دوباره بررسی کن."
                : "تأیید معتبر نبود یا عملیات انجام نشد؛ فهرست را تازه کن و وضعیت را بررسی کن.",
        },
      };
    }
  }

  const request = parsed.data;
  const context = {
    client,
    userId,
    householdId,
    timeZone: request.timeZone,
    message: request.message,
    now,
    actionSecret: environment.actionSigningSecret,
  };
  const response = await orchestrateAssistant({
    message: request.message,
    allowCloud: request.allowCloud && environment.cloudEnabled === "true",
    classifyCloud: () =>
      classifyWithOpenRouter({
        message: request.message,
        enabled: environment.cloudEnabled === "true",
        apiKey: environment.openRouterApiKey,
        modelId: environment.openRouterModelId ?? VERIFIED_FREE_MODEL_IDS[0],
        ...(fetcher ? { fetcher } : {}),
      }),
    runInternal: async (intent) => runAssistantTool(intent, context),
  });
  const status = assistantEngineStatusSchema.parse(response.status);
  const intent = assistantIntentSchema.parse(response.intent);
  return { status: 200, body: { ...response, status, intent } };
}
