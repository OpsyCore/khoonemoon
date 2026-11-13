import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { handleAssistantPayload } from "../../../src/features/assistant/edge-handler.ts";

declare global {
  interface Navigator {
    readonly locks?: {
      request<T>(name: string, callback: () => T | PromiseLike<T>): Promise<T>;
    };
  }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
  Vary: "Origin",
};
const requests = new Map<string, number[]>();
const MAX_REQUESTS_PER_MINUTE = 30;

function reply(status: number, body: Record<string, unknown> | null = null) {
  return new Response(body ? JSON.stringify(body) : null, {
    status,
    headers: {
      ...corsHeaders,
      ...(body ? { "Content-Type": "application/json; charset=utf-8" } : {}),
    },
  });
}

function allowedByLocalRateLimit(userId: string, now: number) {
  const active = (requests.get(userId) ?? []).filter(
    (stamp) => now - stamp < 60_000,
  );
  if (active.length >= MAX_REQUESTS_PER_MINUTE) {
    requests.set(userId, active);
    return false;
  }
  active.push(now);
  requests.set(userId, active);
  if (requests.size > 1000) {
    for (const [key, timestamps] of requests)
      if (!timestamps.some((stamp) => now - stamp < 60_000))
        requests.delete(key);
  }
  return true;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return reply(204);
  if (request.method !== "POST") return reply(405);
  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > 10_000)
    return reply(413, { message: "درخواست بیش از حد طولانی است." });

  const authorization = request.headers.get("authorization") ?? "";
  if (!/^Bearer\s+\S+$/i.test(authorization))
    return reply(401, { message: "برای استفاده از دستیار وارد حساب شو." });
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey)
    return reply(503, { message: "دستیار فعلاً در دسترس نیست." });

  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth.user)
    return reply(401, { message: "نشست معتبر نیست؛ دوباره وارد حساب شو." });

  const now = Date.now();
  if (!allowedByLocalRateLimit(auth.user.id, now))
    return reply(429, {
      message: "درخواست‌ها پشت‌سرهم فرستاده شدند؛ کمی بعد دوباره تلاش کن.",
    });

  const { data: membership, error: membershipError } = await client
    .from("household_members")
    .select("household_id")
    .eq("user_id", auth.user.id)
    .is("left_at", null)
    .maybeSingle();
  if (membershipError)
    return reply(503, { message: "عضویت خانه تأیید نشد؛ دوباره تلاش کن." });

  let raw: string;
  try {
    raw = await request.text();
    if (raw.length > 10_000)
      return reply(413, { message: "درخواست بیش از حد طولانی است." });
  } catch {
    return reply(400, { message: "درخواست خوانده نشد." });
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return reply(400, { message: "درخواست معتبر نیست." });
  }

  try {
    const result = await handleAssistantPayload({
      body,
      client,
      userId: auth.user.id,
      householdId: membership?.household_id ?? null,
      environment: {
        cloudEnabled: Deno.env.get("AI_CLOUD_ENABLED"),
        openRouterApiKey: Deno.env.get("OPENROUTER_API_KEY"),
        openRouterModelId: Deno.env.get("OPENROUTER_MODEL_ID"),
        actionSigningSecret: Deno.env.get("ASSISTANT_ACTION_SIGNING_SECRET"),
      },
      now: new Date(now),
    });
    return reply(result.status, result.body);
  } catch {
    return reply(500, {
      message:
        "دستیار نتوانست درخواست را کامل کند؛ هیچ پاسخ حدسی نمایش داده نشد.",
    });
  }
});
