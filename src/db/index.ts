import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
  __arenaNextJsPostgresqlDb?: NodePgDatabase;
};

/**
 * Lazily creates the direct PostgreSQL connection.
 *
 * The application data layer runs through Supabase (PostgREST + RLS), so a
 * direct database URL is only needed for health checks and back-office jobs.
 * Keeping this lazy means a build (or a deploy without `DATABASE_URL`) never
 * crashes at import time.
 */
export function getDb(): NodePgDatabase {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for direct database access");
  }

  if (!globalForDb.__arenaNextJsPostgresqlDb) {
    const pool =
      globalForDb.__arenaNextJsPostgresqlPool ??
      new Pool({
        connectionString: databaseUrl,
        max: 5,
        connectionTimeoutMillis: 5000,
      });

    globalForDb.__arenaNextJsPostgresqlPool = pool;
    globalForDb.__arenaNextJsPostgresqlDb = drizzle(pool);
  }

  return globalForDb.__arenaNextJsPostgresqlDb;
}

export function isDirectDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}
