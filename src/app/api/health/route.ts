import { sql } from "drizzle-orm";
import { getDb, isDirectDatabaseConfigured } from "@/db";
import { readSupabaseEnv } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

type CheckResult = "ok" | "down" | "not_configured";

async function checkDatabase(): Promise<CheckResult> {
  if (!isDirectDatabaseConfigured()) return "not_configured";

  try {
    await getDb().execute(sql`select 1`);
    return "ok";
  } catch {
    return "down";
  }
}

async function checkSupabase(): Promise<CheckResult> {
  const env = readSupabaseEnv();
  if (!env) return "not_configured";

  try {
    const response = await fetch(`${env.url}/auth/v1/health`, {
      headers: { apikey: env.anonKey },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });

    return response.ok ? "ok" : "down";
  } catch {
    return "down";
  }
}

export async function GET() {
  const [database, supabase] = await Promise.all([
    checkDatabase(),
    checkSupabase(),
  ]);

  const healthy = supabase !== "down" && database !== "down";

  return Response.json(
    {
      ok: healthy,
      checkedAt: new Date().toISOString(),
      services: { supabase, database },
    },
    { status: healthy ? 200 : 503 },
  );
}
