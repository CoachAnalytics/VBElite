import { revalidatePath } from "next/cache";
import { syncFromDataRepo } from "@/lib/sync";

// Loading all 348 schools takes a while on a cold database.
export const maxDuration = 300;

/**
 * Called daily by Vercel Cron (see vercel.json). Vercel sends
 * "Authorization: Bearer $CRON_SECRET", so nobody else can trigger an import.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const result = await syncFromDataRepo("schedule");
  if (result.status === "imported") revalidatePath("/", "layout");
  return Response.json(result, { status: result.status === "error" ? 500 : 200 });
}
