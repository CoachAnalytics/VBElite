// Hosting integrations name the connection string differently: Neon's Vercel
// integration sets DATABASE_URL, Supabase's sets POSTGRES_URL.

/** Pooled connection string for the running app, or null to use the embedded local database. */
export function databaseUrl(): string | null {
  return process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? null;
}

/** Direct (non-pooled) connection string, preferred for migrations. */
export function migrationUrl(): string | null {
  return process.env.DATABASE_URL_UNPOOLED ?? process.env.POSTGRES_URL_NON_POOLING ?? databaseUrl();
}

export const MISSING_URL_ON_VERCEL =
  "No database configured. In the Vercel project, open Storage and connect a Postgres database " +
  "(Neon), or set DATABASE_URL under Settings → Environment Variables, then redeploy.";
