import { requireAdmin } from "@/lib/admin";
import { worksList } from "@/lib/admin-data";

const FILTERS = ["pending", "public", "private", "removed", "official", "all"] as const;

export async function GET(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const raw = new URL(req.url).searchParams.get("filter");
  const filter = (FILTERS as readonly string[]).includes(raw ?? "") ? (raw as (typeof FILTERS)[number]) : "pending";
  return Response.json({ items: await worksList(filter) });
}
