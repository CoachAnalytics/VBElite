import { gunzipSync } from "node:zlib";
import { z } from "zod";
import type { SchoolSeed } from "@/db/seed-types";

// Minimal shape check for the generated data file (collect/build_seed.py output).
const seedFile = z.array(
  z
    .object({
      slug: z.string().min(1),
      name: z.string().min(1),
      division: z.string(),
      positionsCovered: z.array(z.string()),
      seasons: z.array(z.object({ year: z.number().int(), wins: z.number().nullable(), losses: z.number().nullable() }).passthrough()),
      roster: z.array(z.object({ name: z.string(), classYear: z.enum(["Fr", "So", "Jr", "Sr", "Grad"]) }).passthrough()),
      commits: z.array(z.object({ name: z.string(), gradYear: z.number().int() }).passthrough()),
    })
    .passthrough(),
);

/** Reads schools.json or schools.json.gz. Throws on unreadable bytes; returns an error for a wrong shape. */
export function parseSeedFile(bytes: Buffer, gzipped: boolean): { seeds: SchoolSeed[] } | { error: string } {
  const json = JSON.parse((gzipped ? gunzipSync(bytes) : bytes).toString("utf8"));
  const parsed = seedFile.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: `That data file isn't in the expected format (${issue.path.join(".")}: ${issue.message}).` };
  }
  return { seeds: parsed.data as unknown as SchoolSeed[] };
}
