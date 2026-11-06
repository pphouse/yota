import { requireAdmin } from "@/lib/admin";
import { sourcesSummary } from "@/lib/admin-data";

export async function GET(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const days = Math.min(90, Math.max(1, Number(new URL(req.url).searchParams.get("days") ?? 14) || 14));
  return Response.json(await sourcesSummary(days));
}
