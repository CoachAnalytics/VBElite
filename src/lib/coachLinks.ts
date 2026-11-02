import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { LINK_DAYS, parseResponse, type CoachConfirmation, type CoachResponse } from "./coach";

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/**
 * Creates a confirmation link for the athlete's coach and returns its token. Any
 * unanswered link she sent before is withdrawn, so only the newest one works.
 */
export async function createCoachLink(athleteId: number, coachName: string, coachRole: string): Promise<string> {
  const token = randomBytes(24).toString("base64url");
  await db
    .delete(schema.coachConfirmations)
    .where(and(eq(schema.coachConfirmations.athleteId, athleteId), isNull(schema.coachConfirmations.respondedAt)));
  await db.insert(schema.coachConfirmations).values({
    athleteId,
    tokenHash: hashToken(token),
    coachName,
    coachRole,
    expiresAt: new Date(Date.now() + LINK_DAYS * 24 * 60 * 60 * 1000),
  });
  return token;
}

/** The link and its athlete for a token, with why it can't be used (if it can't). */
export async function findCoachLink(token: string) {
  const [row] = await db
    .select({ link: schema.coachConfirmations, athlete: schema.athletes })
    .from(schema.coachConfirmations)
    .innerJoin(schema.athletes, eq(schema.athletes.id, schema.coachConfirmations.athleteId))
    .where(eq(schema.coachConfirmations.tokenHash, hashToken(token)));
  if (!row) return { problem: "missing" as const };
  if (row.link.respondedAt) return { problem: "answered" as const, ...row };
  if (row.link.expiresAt < new Date()) return { problem: "expired" as const, ...row };
  return { problem: null, ...row };
}

/** Records the coach's answers; returns the athlete's id, or null if the link is closed or expired. */
export async function saveCoachResponse(token: string, response: CoachResponse): Promise<number | null> {
  const found = await findCoachLink(token);
  if (found.problem) return null;
  await db
    .update(schema.coachConfirmations)
    .set({ response: JSON.stringify(response), respondedAt: new Date() })
    .where(eq(schema.coachConfirmations.id, found.link.id));
  return found.link.athleteId;
}

/** The athlete's most recent coach confirmation, if any. */
export async function latestConfirmation(athleteId: number): Promise<CoachConfirmation | null> {
  const [row] = await db
    .select()
    .from(schema.coachConfirmations)
    .where(and(eq(schema.coachConfirmations.athleteId, athleteId), isNotNull(schema.coachConfirmations.respondedAt)))
    .orderBy(desc(schema.coachConfirmations.respondedAt))
    .limit(1);
  const r = parseResponse(row?.response);
  if (!row || !r) return null;
  return {
    level: r.level,
    role: r.role,
    coachName: r.coachName,
    coachRole: row.coachRole,
    club: r.club,
    heightIn: r.heightIn,
    respondedAt: row.respondedAt!,
  };
}

/** The athlete's links, newest first, for the status list on her pages. */
export async function coachLinks(athleteId: number) {
  return db
    .select()
    .from(schema.coachConfirmations)
    .where(eq(schema.coachConfirmations.athleteId, athleteId))
    .orderBy(desc(schema.coachConfirmations.createdAt))
    .limit(5);
}
