import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import { logEvent } from "@/lib/store";
import { deleteUgc, getUgc, setOfficial, setUgcStatus } from "@/lib/ugc";

const Body = z.object({ action: z.enum(["approve", "decline", "remove", "restore", "official", "unofficial", "delete"]) });

/**
 * 作品への運営の操作。
 * approve：みんなの作品に載せる／decline：載せない（リンクでは遊べる）／remove：止める（リンクでも開けない）／restore：止めたのを戻す
 * official：運営の作品にする（ホームの「新作」に出す。公開もする）／unofficial：運営の作品から外す／delete：消す
 */
export async function POST(req: Request, ctx: RouteContext<"/api/admin/works/[id]">) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await ctx.params;
  const entry = await getUgc(id);
  if (!entry) return Response.json({ error: "作品が見つかりません" }, { status: 404 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid" }, { status: 400 });
  const { action } = parsed.data;
  if (action === "approve") await setUgcStatus(id, "public");
  else if (action === "decline" || action === "restore") await setUgcStatus(id, "private");
  else if (action === "remove") await setUgcStatus(id, "removed");
  else if (action === "official") {
    await setOfficial(id, true);
    if (entry.meta.status !== "public") await setUgcStatus(id, "public");
  } else if (action === "unofficial") await setOfficial(id, false);
  else if (action === "delete") await deleteUgc(id);
  await logEvent(null, "admin_" + action, { id });
  return Response.json({ ok: true });
}
