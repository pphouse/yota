import { requireAdmin } from "@/lib/admin";
import { feedbackList } from "@/lib/admin-data";

export async function GET(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const kind = new URL(req.url).searchParams.get("kind") === "rating" ? "rating" : "note";
  return Response.json({ items: await feedbackList(kind) });
}
