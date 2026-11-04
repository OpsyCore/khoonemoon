import type { SupabaseClient } from "@supabase/supabase-js";

type Bridge = {
  backgroundCredential: (account: string) => string | null;
  startBackground: (account: string, id: string) => boolean;
};

/** Register only after a matching device credential is stored by Android. */
export async function registerBackgroundReminderDevice(
  client: SupabaseClient,
  bridge: Bridge,
  userId: string,
  isCurrent: () => boolean,
): Promise<void> {
  const raw = bridge.backgroundCredential(userId);
  if (!raw) throw new Error("Credential unavailable");
  const credential = JSON.parse(raw) as {
    id: string;
    secret: string;
    account: string;
  };
  if (
    credential.account !== userId ||
    !/^[0-9a-f-]{36}$/i.test(credential.id) ||
    !/^[0-9a-f]{64}$/.test(credential.secret)
  )
    throw new Error("Invalid credential");
  const { error } = await client.rpc("register_reminder_device", {
    p_id: credential.id,
    p_secret: credential.secret,
  });
  if (error || !isCurrent() || !bridge.startBackground(userId, credential.id))
    throw new Error("Background registration failed");
}
