import { getSession } from "@/lib/session";
import { getUgc } from "@/lib/ugc";
import { getXResult } from "@/lib/x-store";
import { fillPlot } from "@/lib/username";

/** 「Xから生まれる彼」の結果。リンクを知っている人なら誰でも見られる（シェア用） */
export async function GET(_req: Request, ctx: RouteContext<"/api/x/results/[id]">) {
  const result = await getXResult((await ctx.params).id);
  if (!result) return Response.json({ error: "結果が見つかりません" }, { status: 404 });
  const session = await getSession();
  const entry = result.data.plotId ? await getUgc(result.data.plotId) : null;
  const plot = entry && entry.meta.status !== "removed" ? fillPlot(entry.plot, "") : null;
  return Response.json({
    id: result.id,
    status: result.status,
    handle: result.handle,
    name: result.data.name ?? "",
    type: result.data.type ?? "",
    roasts: result.data.roasts ?? [],
    sweet: result.data.sweet ?? "",
    plot,
    plotId: result.data.plotId ?? null,
    isOwner: Boolean(session && session.id === result.sessionId),
    error: result.error,
  });
}
