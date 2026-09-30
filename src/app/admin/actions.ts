"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
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
