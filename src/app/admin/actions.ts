"use server";

import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { loadSchools, type LoadSummary } from "@/lib/import/load";
import { parseWorkbook, WorkbookError } from "@/lib/import/workbook";
import { DIVISIONS } from "@/lib/positions";

export type ImportState = { error?: string; summary?: LoadSummary; fileName?: string } | undefined;

const options = z.object({
  division: z.enum(DIVISIONS),
  homeState: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, "Home state must be a 2-letter code, e.g. OH"),
  rosterSeason: z.coerce.number().int().min(2000).max(2100),
});

export async function importWorkbook(_: ImportState, form: FormData): Promise<ImportState> {
  await requireAdmin();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose an .xlsx file to upload." };
  if (!file.name.toLowerCase().endsWith(".xlsx")) return { error: "The file must be an Excel .xlsx workbook." };

  const parsed = options.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    const seeds = await parseWorkbook(new Uint8Array(await file.arrayBuffer()), parsed.data);
    if (!seeds.length) return { error: "No schools found on the Comparison tab." };
    const summary = await loadSchools(seeds);
    revalidatePath("/", "layout");
    return { summary, fileName: file.name };
  } catch (e) {
    if (e instanceof WorkbookError) return { error: e.message };
    console.error("Workbook import failed", e);
    return { error: "Couldn't read that workbook. Check it matches the Volleyball Recruiting Comparison format." };
  }
}

export type AdminState = { error?: string; message?: string } | undefined;

const newAdmin = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().optional(),
});

/**
 * Makes an existing account an admin, or creates a new admin login with a
 * starting password the owner shares with them (they can change it on Profile).
 */
export async function addAdmin(_: AdminState, form: FormData): Promise<AdminState> {
  await requireAdmin();
  const parsed = newAdmin.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { email, password } = parsed.data;

  const [existing] = await db.select().from(schema.users).where(eq(schema.users.email, email));
  if (existing) {
    if (existing.role === "admin") return { error: `${email} is already an admin.` };
    await db.update(schema.users).set({ role: "admin" }).where(eq(schema.users.id, existing.id));
    revalidatePath("/admin");
    return { message: `${email} is now an admin. They'll see the Admin page next time they open the site.` };
  }
  if (!password || password.length < 8) {
    return { error: "No account uses that email yet. Set a starting password (8+ characters) to create one." };
  }
  await db.insert(schema.users).values({ email, passwordHash: hashPassword(password), role: "admin" });
  revalidatePath("/admin");
  return { message: `Admin login created for ${email}. Share the starting password with them privately.` };
}

export async function removeAdmin(form: FormData) {
  const me = await requireAdmin();
  const userId = Number(form.get("userId"));
  // You can't remove yourself, so the site always keeps at least one admin.
  if (!Number.isInteger(userId) || userId === me.id) return;
  await db
    .update(schema.users)
    .set({ role: "user" })
    .where(and(eq(schema.users.id, userId), ne(schema.users.id, me.id)));
  revalidatePath("/admin");
}
