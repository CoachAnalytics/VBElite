"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema } from "@/db";
import { createSession, destroySession, requireUser } from "@/lib/auth";
import { parseHeight } from "@/lib/format";
import { lookupZip } from "@/lib/geo";
import { hashPassword, verifyPassword } from "@/lib/password";
import { POSITIONS } from "@/lib/positions";
import { getAthlete } from "@/lib/queries";
import { isTier } from "@/lib/tiers";

export type FormState = { error?: string; ok?: boolean } | undefined;

const credentials = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function signup(_: FormState, form: FormData): Promise<FormState> {
  const parsed = credentials.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { email, password } = parsed.data;
  const [existing] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email));
  if (existing) return { error: "An account with that email already exists. Log in instead." };
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
});

export async function saveAthlete(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = athleteSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const heightIn = d.height ? parseHeight(d.height) : null;
  if (d.height && heightIn == null) return { error: `Couldn't read the height "${d.height}". Try 6'1" or 73.` };
  const place = lookupZip(d.homeZip);
  if (!place) return { error: "We couldn't find that ZIP code." };

  const values = {
    name: d.name,
    gradYear: d.gradYear,
    position: d.position,
    heightIn,
    homeZip: d.homeZip,
    homeCity: place.city,
    homeState: place.state,
    latitude: place.latitude,
    longitude: place.longitude,
  };
  const existing = await getAthlete(user.id);
  if (existing) {
    await db.update(schema.athletes).set(values).where(eq(schema.athletes.id, existing.id));
  } else {
    await db.insert(schema.athletes).values({ ...values, userId: user.id });
  }
  revalidatePath("/", "layout");
  if (!existing) redirect("/schools");
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
  revalidatePath("/compare");
}
