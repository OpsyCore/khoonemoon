import {
  parseInternalIntent,
  type AssistantEngineStatus,
  type AssistantIntent,
  type InternalIntent,
} from "./core";

export type AssistantResponse = {
  source: "internal" | "cloud";
  status: AssistantEngineStatus;
  cloudStatus?: AssistantEngineStatus;
  intent: AssistantIntent;
  text: string;
  action?: {
    type: "create_household_task" | "create_reminder" | "add_shopping_item";
    label: string;
    token: string;
  };
};

export async function orchestrateAssistant({
  message,
  allowCloud,
  classifyCloud,
  runInternal,
}: {
  message: string;
  allowCloud: boolean;
  classifyCloud: () => Promise<{
    intent: AssistantIntent;
    status: AssistantEngineStatus;
  }>;
  runInternal: (
    parsed: InternalIntent,
    context: { source: "internal" | "cloud"; status: AssistantEngineStatus },
  ) => Promise<Omit<AssistantResponse, "source" | "status" | "cloudStatus">>;
}): Promise<AssistantResponse> {
  const local = parseInternalIntent(message);
  let intent = local.intent;
  let source: AssistantResponse["source"] = "internal";
  let cloudStatus: AssistantEngineStatus = "cloud_model_disabled";

  if (allowCloud) {
    try {
      const cloud = await classifyCloud();
      cloudStatus = cloud.status;
      if (cloud.status === "cloud_available" && cloud.intent !== "unknown") {
        intent = cloud.intent;
        source = "cloud";
      }
    } catch {
      cloudStatus = "cloud_unavailable";
    }
  }

  const parsed = { ...local, intent };
  const status = source === "cloud" ? "cloud_available" : "internal_active";
  try {
    const result = await runInternal(parsed, { source, status });
    return {
      ...result,
      source,
      status,
      ...(source === "internal" ? { cloudStatus } : {}),
    };
  } catch {
    return {
      source: "internal",
      status: "internal_active",
      cloudStatus: source === "cloud" ? "cloud_unavailable" : cloudStatus,
      intent: local.intent,
      text: "دریافت اطلاعات تأیید نشد. لطفاً اتصال را بررسی کن و دوباره تلاش کن؛ چیزی از روی حدس نمایش داده نشد.",
    };
  }
}
