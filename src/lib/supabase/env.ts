export type SupabaseEnv = {
  url: string;
  anonKey: string;
};

/** Returns the Supabase configuration, or `null` when it is not set up yet. */
export function readSupabaseEnv(): SupabaseEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) return null;

  return { url, anonKey };
}

export function getSupabaseEnv(): SupabaseEnv {
  const env = readSupabaseEnv();

  if (!env) {
    throw new Error(
      "Supabase environment variables are not configured. " +
        "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  return env;
}
