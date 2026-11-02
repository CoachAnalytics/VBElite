import { requireAdmin } from "@/lib/auth";
import { researchDataset } from "@/lib/queries";

const cell = (v: unknown) => {
  if (v == null) return "";
  const s = v instanceof Date ? v.toISOString().slice(0, 10) : typeof v === "number" ? String(Math.round(v * 100) / 100) : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Downloads VB Elite's own dataset (anonymized; opted-out athletes left out) as CSV: ?kind=measurements|outcomes|seasons. */
export async function GET(req: Request) {
  await requireAdmin();
  const asked = new URL(req.url).searchParams.get("kind");
  const kind = asked === "outcomes" || asked === "seasons" ? asked : "measurements";
  const rows: Record<string, unknown>[] = (await researchDataset())[kind];
  const cols = rows.length ? Object.keys(rows[0]) : ["athlete"];
  const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\n");
  return new Response(csv + "\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="vbelite-${kind}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
