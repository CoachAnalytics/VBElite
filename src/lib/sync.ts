import { desc, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { parseSeedFile } from "@/lib/import/seedFile";
import { loadSchools } from "@/lib/import/load";

/**
 * Pulls seed/schools.json.gz from the private data repo and loads it when it has
 * changed since the last successful import. Runs daily from Vercel Cron
 * (/api/cron/sync) and from the Admin page's "Sync now" button.
 *
 * Needs DATA_REPO_TOKEN: a GitHub fine-grained token with read-only "Contents"
 * access to that one repository. DATA_REPO overrides the default repository.
 */
const DATA_PATH = "seed/schools.json.gz";

export function dataRepo() {
  return process.env.DATA_REPO || "CoachAnalytics/VBElite-data";
}

export function syncConfigured() {
  return Boolean(process.env.DATA_REPO_TOKEN);
}

export type SyncResult = { status: "imported" | "unchanged" | "error"; message: string; schools?: number };

async function github(path: string, accept: string) {
  const res = await fetch(`https://api.github.com/repos/${dataRepo()}/contents/${path}`, {
    headers: {
      Authorization: `Bearer ${process.env.DATA_REPO_TOKEN}`,
      Accept: accept,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "VBElite-data-sync",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const hint =
      res.status === 401 || res.status === 403
        ? "the DATA_REPO_TOKEN setting is invalid, expired or can't read that repository"
        : res.status === 404
          ? `${path} wasn't found in ${dataRepo()} (or the token can't see that repository)`
          : `GitHub returned ${res.status}`;
    throw new Error(`Couldn't download the data file: ${hint}.`);
  }
  return res;
}

/**
 * Bump when the importer starts reading new fields, so files already imported by older code
 * are imported again (e.g. 2 = coach contacts). Stored with the file's SHA.
 */
const IMPORT_VERSION = 2;

export async function syncFromDataRepo(trigger: "schedule" | "manual"): Promise<SyncResult> {
  const log = (r: SyncResult, sha: string | null = null) =>
    db.insert(schema.dataSyncs).values({ trigger, status: r.status, message: r.message, schools: r.schools, sha }).then(() => r);

  if (!syncConfigured()) {
    return log({ status: "error", message: "Automatic updates aren't set up yet: add the DATA_REPO_TOKEN setting in Vercel." });
  }

  let sha: string | null = null;
  try {
    const meta = (await (await github(DATA_PATH, "application/vnd.github+json")).json()) as { sha: string };
    sha = `${meta.sha}@v${IMPORT_VERSION}`;

    const [last] = await db
      .select({ sha: schema.dataSyncs.sha, status: schema.dataSyncs.status })
      .from(schema.dataSyncs)
      // Only successful runs count as "the version we have"; a failed import is retried next time.
      .where(inArray(schema.dataSyncs.status, ["imported", "unchanged"]))
      .orderBy(desc(schema.dataSyncs.ranAt))
      .limit(1);
    // "Sync now" always imports; the daily run skips a file this code version already loaded.
    if (trigger === "schedule" && last?.sha === sha) return log({ status: "unchanged", message: "Already up to date." }, sha);

    const bytes = Buffer.from(await (await github(DATA_PATH, "application/vnd.github.raw")).arrayBuffer());
    const parsed = parseSeedFile(bytes, true);
    if ("error" in parsed) return log({ status: "error", message: parsed.error }, sha);

    const summary = await loadSchools(parsed.seeds);
    return log(
      {
        status: "imported",
        message: `Updated ${summary.schools} schools (${summary.roster} roster players, ${summary.commits} commits).`,
        schools: summary.schools,
      },
      sha,
    );
  } catch (e) {
    console.error("Data sync failed", e);
    const message = e instanceof Error && e.message.startsWith("Couldn't download") ? e.message : "The data file couldn't be read or loaded.";
    return log({ status: "error", message }, sha);
  }
}

