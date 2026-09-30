/**
 * Applies the SQL migrations in ./drizzle. Runs automatically on every Vercel
 * deploy (see "vercel-build" in package.json), so schema changes ship with the code.
 */
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { migrate as migratePostgres } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { MISSING_URL_ON_VERCEL, migrationUrl } from "../src/db/url";

async function main() {
  const config = { migrationsFolder: "./drizzle" };
  const url = migrationUrl();
  if (url) {
    const client = postgres(url, { max: 1, onnotice: () => {} });
    await migratePostgres(drizzlePostgres(client), config);
    await client.end();
    console.log(`Migrations applied to ${new URL(url).host}.`);
  } else if (process.env.VERCEL) {
    throw new Error(MISSING_URL_ON_VERCEL);
  } else {
    const { db } = await import("../src/db");
    await migratePglite(db as unknown as Parameters<typeof migratePglite>[0], config);
    console.log("Migrations applied to the local database.");
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
