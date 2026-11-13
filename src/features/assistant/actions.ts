import { z } from "zod";
import { createTaskSchema } from "@/features/tasks/schemas";
import { createShoppingItemSchema } from "@/features/shopping/schemas";
import { createRemindersSchema } from "@/features/reminders/schemas";

export const assistantActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("create_household_task"),
    payload: createTaskSchema,
  }),
  z.object({
    type: z.literal("add_shopping_item"),
    payload: createShoppingItemSchema,
  }),
  z.object({
    type: z.literal("create_reminder"),
    payload: createRemindersSchema,
  }),
]);
export type AssistantAction = z.infer<typeof assistantActionSchema>;

export const assistantActionTokenSchema = z.object({
  v: z.literal(1),
  userId: z.string().uuid(),
  householdId: z.string().uuid().nullable(),
  requestId: z.string().uuid(),
  expiresAt: z.number().int().positive(),
  action: assistantActionSchema,
});
export type AssistantActionClaims = z.infer<typeof assistantActionTokenSchema>;

function base64UrlEncode(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}
function base64UrlDecode(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
async function signingKey(secret: string, usage: KeyUsage[]) {
  if (secret.length < 32) throw new Error("ACTION_SIGNING_DISABLED");
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    usage,
  );
}

export async function signAssistantAction(
  action: AssistantAction,
  identity: { userId: string; householdId: string | null },
  secret: string,
  now = Date.now(),
) {
  const claims = assistantActionTokenSchema.parse({
    v: 1,
    ...identity,
    requestId: crypto.randomUUID(),
    expiresAt: now + 10 * 60 * 1000,
    action,
  });
  const payload = base64UrlEncode(
    new TextEncoder().encode(JSON.stringify(claims)),
  );
  const key = await signingKey(secret, ["sign"]);
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  return {
    token: `${payload}.${base64UrlEncode(new Uint8Array(signature))}`,
    claims,
  };
}

export async function verifyAssistantAction(
  token: string,
  secret: string,
  identity: { userId: string; householdId: string | null },
  now = Date.now(),
) {
  if (token.length > 12000 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token))
    throw new Error("INVALID_ACTION_TOKEN");
  const [payload, encodedSignature] = token.split(".");
  const key = await signingKey(secret, ["verify"]);
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    base64UrlDecode(encodedSignature),
    new TextEncoder().encode(payload),
  );
  if (!valid) throw new Error("INVALID_ACTION_TOKEN");
  let raw: unknown;
  try {
    raw = JSON.parse(new TextDecoder().decode(base64UrlDecode(payload)));
  } catch {
    throw new Error("INVALID_ACTION_TOKEN");
  }
  const parsed = assistantActionTokenSchema.safeParse(raw);
  if (!parsed.success) throw new Error("INVALID_ACTION_TOKEN");
  const claims = parsed.data;
  if (
    claims.userId !== identity.userId ||
    claims.householdId !== identity.householdId
  )
    throw new Error("ACTION_CONTEXT_CHANGED");
  if (claims.expiresAt <= now || claims.expiresAt > now + 10 * 60 * 1000)
    throw new Error("ACTION_TOKEN_EXPIRED");
  return claims;
}
