"use server";

import { and, count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema } from "@/db";
import { createSession, destroySession, requireUser } from "@/lib/auth";
import { parseHeight } from "@/lib/format";
import { answersSchema, STEPS } from "@/lib/questionnaire";
import { COACH_ROLES, responseSchema } from "@/lib/coach";
import { eventSchema } from "@/lib/recruiting";
import { CONTACT_SOURCES } from "@/lib/coachEmail";
import { createCoachLink, saveCoachResponse } from "@/lib/coachLinks";
import { lookupZip } from "@/lib/geo";
import { hashPassword, verifyPassword } from "@/lib/password";
import { POSITIONS } from "@/lib/positions";
import { getAthlete } from "@/lib/queries";
import { isTier } from "@/lib/tiers";

// `values` echoes what was submitted so a form can refill its fields after an error;
// `at` changes on every failed attempt so the form re-mounts with them.
export type FormState = { error?: string; ok?: boolean; values?: Record<string, string>; at?: number } | undefined;

const credentials = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const signupForm = credentials
  .extend({ confirm: z.string() })
  .refine((d) => d.password === d.confirm, { message: "The passwords don't match. Type them again." });

export async function signup(_: FormState, form: FormData): Promise<FormState> {
  // Only the email is echoed back after an error; passwords are never sent back to the page.
  const keep = { email: String(form.get("email") ?? "") };
  const at = Date.now();
  const parsed = signupForm.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message, values: keep, at };
  const { email, password } = parsed.data;
  const [existing] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email));
  if (existing) return { error: "An account with that email already exists. Log in instead.", values: keep, at };
  // The first account on a new site becomes its admin, so the owner needs no setup step.
  const [anyAdmin] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.role, "admin")).limit(1);
  const role = anyAdmin ? "user" : "admin";
  const [user] = await db.insert(schema.users).values({ email, passwordHash: hashPassword(password), role }).returning();
  await createSession(user.id);
  redirect("/profile");
}

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const parsed = credentials.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Incorrect email or password." };
  const { email, password } = parsed.data;
  const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email));
  if (!user || !verifyPassword(password, user.passwordHash)) return { error: "Incorrect email or password." };
  await createSession(user.id);
  redirect("/compare");
}

const passwordChange = z
  .object({
    current: z.string().min(1, "Enter your current password"),
    next: z.string().min(8, "New password must be at least 8 characters"),
    confirm: z.string(),
  })
  .refine((d) => d.next === d.confirm, { message: "The new passwords don't match" });

export async function changePassword(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser();
  const parsed = passwordChange.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, me.id));
  if (!user || !verifyPassword(parsed.data.current, user.passwordHash)) {
    return { error: "Your current password is incorrect." };
  }
  await db.update(schema.users).set({ passwordHash: hashPassword(parsed.data.next) }).where(eq(schema.users.id, me.id));
  // Sign out every other device that knew the old password.
  await db.delete(schema.sessions).where(eq(schema.sessions.userId, me.id));
  await createSession(me.id);
  return { ok: true };
}

export async function logout() {
  await destroySession();
  redirect("/");
}

const currentYear = new Date().getFullYear();

const athleteSchema = z.object({
  name: z.string().trim().min(1, "Enter the athlete's name").max(80),
  gradYear: z.coerce
    .number()
    .int()
    .min(currentYear, `Graduation year must be ${currentYear} or later`)
    .max(currentYear + 8, "Graduation year looks too far out"),
  position: z.enum(POSITIONS.map((p) => p.code) as [string, ...string[]], { message: "Choose a position" }),
  height: z.string().trim().optional(),
  homeZip: z.string().trim().regex(/^\d{5}$/, "Enter a 5-digit ZIP code"),
  birthMonth: z.union([z.literal(""), z.coerce.number().int().min(1).max(12)]).optional(),
  birthYear: z.union([z.literal(""), z.coerce.number().int().min(currentYear - 25).max(currentYear - 8)]).optional(),
});

export async function saveAthlete(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const submitted = Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]));
  const fail = (error: string) => ({ error, values: submitted, at: Date.now() });
  const parsed = athleteSchema.safeParse(submitted);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const d = parsed.data;
  const heightIn = d.height ? parseHeight(d.height) : null;
  if (d.height && heightIn == null) return fail(`Couldn't read the height "${d.height}". Try 5'10" or 70.`);
  const place = lookupZip(d.homeZip);
  if (!place) return fail("We couldn't find that ZIP code.");
  const birthMonth = d.birthMonth === "" || d.birthMonth == null ? null : d.birthMonth;
  const birthYear = d.birthYear === "" || d.birthYear == null ? null : d.birthYear;
  if ((birthMonth == null) !== (birthYear == null)) return fail("Choose both the birth month and year, or leave both blank.");
  if (birthYear != null && (d.gradYear - birthYear < 16 || d.gradYear - birthYear > 20)) {
    return fail("That birth year doesn't fit the graduation year. Please check both.");
  }

  const existing = await getAthlete(user.id);
  const values = {
    name: d.name,
    gradYear: d.gradYear,
    position: d.position,
    heightIn,
    ...(heightIn !== (existing?.heightIn ?? null) && { heightUpdatedAt: heightIn == null ? null : new Date() }),
    birthMonth,
    birthYear,
    homeZip: d.homeZip,
    homeCity: place.city,
    homeState: place.state,
    latitude: place.latitude,
    longitude: place.longitude,
  };
  if (existing) {
    await db.update(schema.athletes).set(values).where(eq(schema.athletes.id, existing.id));
  } else {
    await db.insert(schema.athletes).values({ ...values, userId: user.id });
  }
  revalidatePath("/", "layout");
  // New athletes continue to the starting-point questionnaire.
  if (!existing) redirect("/questionnaire");
  return { ok: true };
}

async function requireAthlete() {
  const user = await requireUser();
  const athlete = await getAthlete(user.id);
  if (!athlete) redirect("/profile");
  return athlete;
}

export async function toggleSchool(form: FormData) {
  const athlete = await requireAthlete();
  const schoolId = Number(form.get("schoolId"));
  if (!Number.isInteger(schoolId)) return;
  const where = and(eq(schema.savedSchools.athleteId, athlete.id), eq(schema.savedSchools.schoolId, schoolId));
  const [saved] = await db.select().from(schema.savedSchools).where(where);
  if (saved) {
    await db.delete(schema.savedSchools).where(where);
  } else {
    await db.insert(schema.savedSchools).values({ athleteId: athlete.id, schoolId });
  }
  revalidatePath("/", "layout");
}

export async function setTier(form: FormData) {
  const athlete = await requireAthlete();
  const schoolId = Number(form.get("schoolId"));
  const tier = String(form.get("tier"));
  if (!Number.isInteger(schoolId) || !isTier(tier)) return;
  await db
    .update(schema.savedSchools)
    .set({ tier })
    .where(and(eq(schema.savedSchools.athleteId, athlete.id), eq(schema.savedSchools.schoolId, schoolId)));
  revalidatePath("/", "layout");
}

/** Saves the starting-point questionnaire (sent as one JSON field) and shows the recommendations. */
export async function saveQuestionnaire(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const athlete = await getAthlete(user.id);
  if (!athlete) redirect("/profile");
  let raw: unknown;
  try {
    raw = JSON.parse(String(form.get("answers") ?? ""));
  } catch {
    return { error: "Something went wrong reading your answers. Please try again." };
  }
  const parsed = answersSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: `Please check "${questionLabel(String(issue.path[0]))}": ${issue.message}` };
  }
  await db
    .update(schema.athletes)
    .set({ questionnaire: JSON.stringify(parsed.data), questionnaireAt: new Date() })
    .where(eq(schema.athletes.id, athlete.id));
  revalidatePath("/", "layout");
  redirect("/recommendations");
}

function questionLabel(id: string) {
  return STEPS.flatMap((s) => s.questions).find((q) => q.id === id)?.label ?? id;
}

const RECOMMENDED_TIER: Record<string, string> = { reach: "reach", target: "main", likely: "expand" };

/** Adds recommended schools to the athlete's list (already-saved schools keep their list). */
export async function addRecommended(form: FormData) {
  const athlete = await requireAthlete();
  const picks = form
    .getAll("pick")
    .map((v) => String(v).split(":"))
    .map(([id, tier]) => ({ schoolId: Number(id), tier: RECOMMENDED_TIER[tier] ?? "main" }))
    .filter((p) => Number.isInteger(p.schoolId));
  if (!picks.length) return;
  await db
    .insert(schema.savedSchools)
    .values(picks.map((p) => ({ athleteId: athlete.id, schoolId: p.schoolId, tier: p.tier })))
    .onConflictDoNothing();
  revalidatePath("/", "layout");
}

export type CoachLinkState = { error?: string; url?: string; coachName?: string } | undefined;

const coachLinkForm = z.object({
  coachName: z.string().trim().min(2, "Enter the coach's name").max(80),
  coachRole: z.enum(COACH_ROLES.map((r) => r.value) as [string, ...string[]]),
});

/** Creates a confirmation link the athlete sends her coach (by text or email, from her own phone). */
export async function createCoachConfirmation(_: CoachLinkState, form: FormData): Promise<CoachLinkState> {
  const athlete = await requireAthlete();
  const parsed = coachLinkForm.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const token = await createCoachLink(athlete.id, parsed.data.coachName, parsed.data.coachRole);
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  revalidatePath("/recommendations");
  revalidatePath("/profile");
  return { url: `${proto}://${host}/coach/${token}`, coachName: parsed.data.coachName };
}

export type CoachResponseState = { error?: string; done?: boolean } | undefined;

/** A coach's answers through a confirmation link. No account needed: the link is the permission. */
export async function submitCoachResponse(_: CoachResponseState, form: FormData): Promise<CoachResponseState> {
  const token = String(form.get("token") ?? "");
  const heightText = String(form.get("height") ?? "").trim();
  const heightIn = form.get("heightRight") === "no" ? parseHeight(heightText) : null;
  if (form.get("heightRight") === "no" && heightIn == null) {
    return { error: `Couldn't read the height "${heightText}". Try 5'10" or 70.` };
  }
  const parsed = responseSchema.safeParse({
    coachName: form.get("coachName"),
    club: form.get("club") ?? "",
    level: form.get("level"),
    role: form.get("role"),
    heightIn,
    note: form.get("note") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const ok = await saveCoachResponse(token, parsed.data);
  if (!ok) return { error: "This link has already been answered or has expired. Ask the athlete to send a new one." };
  return { done: true };
}

export type EventFormState = { error?: string; ok?: boolean; at?: number } | undefined;

/** Adds a recruiting log entry and puts the school on her list if it isn't there yet. */
export async function addRecruitingEvent(_: EventFormState, form: FormData): Promise<EventFormState> {
  const athlete = await requireAthlete();
  const parsed = eventSchema.safeParse({
    schoolId: form.get("schoolId"),
    type: form.get("type"),
    date: form.get("date"),
    coachName: form.get("coachName") ?? "",
    note: form.get("note") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const [school] = await db.select({ id: schema.schools.id }).from(schema.schools).where(eq(schema.schools.id, d.schoolId));
  if (!school) return { error: "Choose a school from the list" };
  await db.insert(schema.recruitingEvents).values({
    athleteId: athlete.id,
    schoolId: d.schoolId,
    type: d.type,
    date: d.date,
    coachName: d.coachName || null,
    note: d.note || null,
  });
  await db.insert(schema.savedSchools).values({ athleteId: athlete.id, schoolId: d.schoolId }).onConflictDoNothing();
  revalidatePath("/", "layout");
  return { ok: true, at: Date.now() };
}

export async function deleteRecruitingEvent(form: FormData) {
  const athlete = await requireAthlete();
  const id = Number(form.get("id"));
  if (!Number.isInteger(id)) return;
  await db
    .delete(schema.recruitingEvents)
    .where(and(eq(schema.recruitingEvents.id, id), eq(schema.recruitingEvents.athleteId, athlete.id)));
  revalidatePath("/", "layout");
}

// ---------- Coach emails families add ----------

const contactSchema = z
  .object({
    schoolId: z.coerce.number().int().positive(),
    role: z.enum(["program", "head", "recruiting", "assistant", "operations"], { message: "Choose who this email is for" }),
    name: z.string().trim().max(80),
    title: z.string().trim().max(120),
    email: z.string().trim().toLowerCase().email("Enter a full email address, like coach@school.edu").max(200),
    source: z.enum(CONTACT_SOURCES.map((x) => x.value) as [string, ...string[]], { message: "Tell us where you got it" }),
  })
  .refine((d) => d.role === "program" || d.name.length > 0, { message: "Enter the coach's name", path: ["name"] });

export type ContactFormState = { error?: string; ok?: boolean; at?: number } | undefined;

/** Saves a coach email a family found. They see it right away; everyone else once an admin approves it. */
export async function submitContact(_: ContactFormState, form: FormData): Promise<ContactFormState> {
  const user = await requireUser();
  const parsed = contactSchema.safeParse({
    schoolId: form.get("schoolId"),
    role: form.get("role"),
    name: form.get("name") ?? "",
    title: form.get("title") ?? "",
    email: form.get("email") ?? "",
    source: form.get("source"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const [school] = await db.select({ id: schema.schools.id }).from(schema.schools).where(eq(schema.schools.id, d.schoolId));
  if (!school) return { error: "That school wasn't found." };
  const [{ n }] = await db
    .select({ n: count() })
    .from(schema.contactSubmissions)
    .where(and(eq(schema.contactSubmissions.userId, user.id), eq(schema.contactSubmissions.status, "pending")));
  if (n >= 25) return { error: "You have 25 emails waiting for review. Please try again once we've checked them." };
  await db.insert(schema.contactSubmissions).values({
    schoolId: d.schoolId,
    userId: user.id,
    role: d.role,
    name: d.name || null,
    title: d.title || null,
    email: d.email,
    source: d.source,
  });
  revalidatePath("/schools/[slug]", "page");
  revalidatePath("/admin");
  return { ok: true, at: Date.now() };
}
