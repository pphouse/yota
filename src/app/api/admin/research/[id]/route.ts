import { requireAdmin } from "@/lib/admin";
import { deleteDataset } from "@/lib/research";

/** 調査データを消す */
export async function DELETE(_req: Request, ctx: RouteContext<"/api/admin/research/[id]">) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await ctx.params;
  await deleteDataset(id);
  return Response.json({ ok: true });
}
