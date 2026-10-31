import { getPlot } from "@/lib/characters";
import { getSession } from "@/lib/session";
import { getUgc } from "@/lib/ugc";
import { isUgcId } from "@/lib/ugc-schema";
import { fillPlot } from "@/lib/username";

/** 作品を1つ返す。ユーザーの作品なら、作者名・公開の段階・自分の作品かどうかも返す */
export async function GET(_req: Request, ctx: RouteContext<"/api/plots/[id]">) {
  const { id } = await ctx.params;
  if (!isUgcId(id)) {
    const plot = getPlot(id);
    return plot ? Response.json({ plot }) : Response.json({ error: "作品が見つかりません" }, { status: 404 });
  }
  const entry = await getUgc(id);
  if (!entry || entry.meta.status === "removed") return Response.json({ error: "作品が見つかりません" }, { status: 404 });
  const session = await getSession();
  // 画面に出す文章の {{user}} は「あなた」にする（会話では、サーバーが遊ぶ人の名前にする）
  return Response.json({ plot: fillPlot(entry.plot, ""), meta: entry.meta, isOwner: Boolean(session && session.id === entry.sessionId) });
}
