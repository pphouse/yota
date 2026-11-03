import { requireAdmin } from "@/lib/admin";
import { stats } from "@/lib/admin-data";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  return Response.json(await stats());
}
