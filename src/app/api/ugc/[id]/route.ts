import { z } from "zod";
import { getSession } from "@/lib/session";
import { logEvent } from "@/lib/store";
import { deleteUgc, getUgc, setUgcStatus } from "@/lib/ugc";

const Body = z.object({ action: z.enum(["submit", "withdraw", "delete"]) });

/** 作者だけができる操作：一覧への掲載を申請する・申請を取り下げる・削除する */
export async function PATCH(req: Request, ctx: RouteContext<"/api/ugc/[id]">) {
  const { id } = await ctx.params;
  const session = await getSession();
  const entry = await getUgc(id);
  if (!session || !entry || entry.sessionId !== session.id || entry.meta.status === "removed") {
    return Response.json({ error: "作品が見つかりません" }, { status: 404 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid" }, { status: 400 });
  const { action } = parsed.data;
  if (action === "delete") await deleteUgc(id);
  else if (action === "submit" && entry.meta.status === "private") await setUgcStatus(id, "pending");
  else if (action === "withdraw") await setUgcStatus(id, "private");
  await logEvent(session.id, "ugc_" + action, { id });
  return Response.json({ ok: true });
}
