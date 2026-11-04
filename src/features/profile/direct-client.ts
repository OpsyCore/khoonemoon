import type { SupabaseClient } from "@supabase/supabase-js";
import { profileSchema } from "./schema";
import type { ProfileRecord } from "./types";

const COLUMNS = "id, full_name, timezone, locale, created_at, updated_at";
async function userId(client: SupabaseClient): Promise<string> {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error("ابتدا وارد حساب خود شوید.");
  return data.user.id;
}
export function directProfile(client: SupabaseClient) {
  return {
    async get(): Promise<ProfileRecord> {
      const id = await userId(client);
      const { data, error } = await client
        .from("profiles")
        .select(COLUMNS)
        .eq("id", id)
        .single();
      if (error || !data) throw new Error("دریافت پروفایل ناموفق بود.");
      return data as ProfileRecord;
    },
    async update(input: unknown): Promise<ProfileRecord> {
      const fields = profileSchema.parse(input);
      const id = await userId(client);
      const { data, error } = await client
        .from("profiles")
        .upsert({ id, ...fields }, { onConflict: "id" })
        .select(COLUMNS)
        .single();
      if (error || !data) throw new Error("ذخیره پروفایل ناموفق بود.");
      return data as ProfileRecord;
    },
  };
}
