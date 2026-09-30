import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import { PGlite } from "@electric-sql/pglite";
import postgres from "postgres";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";
import { databaseUrl, MISSING_URL_ON_VERCEL } from "./url";

type DB = ReturnType<typeof drizzlePostgres<typeof schema>>;

function isAlive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

// The embedded database is a set of files that only one process may open at a
// time; a second writer corrupts it. Hold a pid lock file while it's open.
function lockPglite(dir: string) {
  const lock = path.join(dir, "..", `${path.basename(dir)}.lock`);
  try {
    const holder = Number(fs.readFileSync(lock, "utf8"));
    if (holder && holder !== process.pid && isAlive(holder)) {
      throw new Error(
        `The local database (${dir}) is in use by another process (pid ${holder}). ` +
          `Stop the dev server before running database scripts, or set DATABASE_URL to use a Postgres server.`,
      );
    }
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
  fs.writeFileSync(lock, String(process.pid));
  process.on("exit", () => {
    try {
      if (fs.readFileSync(lock, "utf8") === String(process.pid)) fs.unlinkSync(lock);
    } catch {}
  });
}

// With DATABASE_URL set (Supabase, Neon, any Postgres) we connect to it.
// Without it we use an embedded Postgres (PGlite) stored in ./.data so the
// app runs locally with zero setup.
function createDb(): DB {
  const url = databaseUrl();
  if (url) {
    // prepare: false keeps it compatible with transaction-mode poolers (Supabase, Neon).
    return drizzlePostgres(postgres(url, { prepare: false, max: 5, idle_timeout: 20 }), { schema });
  }
  if (process.env.VERCEL) throw new Error(MISSING_URL_ON_VERCEL);
  const dir = process.env.PGLITE_DIR ?? ".data/pglite";
  fs.mkdirSync(dir, { recursive: true });
  lockPglite(dir);
  return drizzlePglite(new PGlite(dir), { schema }) as unknown as DB;
}

const globalForDb = globalThis as unknown as { db?: DB };

// Connect on first use, not at import, so build steps that merely load this
// module never open the database.
export const db = new Proxy({} as DB, {
  get(_, prop) {
    globalForDb.db ??= createDb();
    const value = Reflect.get(globalForDb.db, prop, globalForDb.db);
    return typeof value === "function" ? value.bind(globalForDb.db) : value;
  },
});

export { schema };
