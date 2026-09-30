/** Applies the SQL migrations in ./drizzle to DATABASE_URL (or the local embedded database). */
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { migrate as migratePostgres } from "drizzle-orm/postgres-js/migrator";
import { db } from "../src/db";

async function main() {
  const config = { migrationsFolder: "./drizzle" };
  if (process.env.DATABASE_URL) {
    await migratePostgres(db, config);
  } else {
    await migratePglite(db as unknown as Parameters<typeof migratePglite>[0], config);
  }
  console.log("Migrations applied.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
