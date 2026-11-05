import { isAdmin } from "@/lib/admin";
import { getDatasetJson } from "@/lib/research";
import { renderResearchViewer } from "@/lib/research-viewer";

/**
 * 調査データのビューワー（管理者だけ）。アイコンを押すと、そのアカウントの投稿が開く。
 * ログインしていなければ管理者画面へ戻す。
 */
export async function GET(req: Request, ctx: RouteContext<"/admin/research/[id]">) {
  if (!(await isAdmin())) return Response.redirect(new URL("/admin", req.url), 303);
  const { id } = await ctx.params;
  const found = await getDatasetJson(id);
  if (!found) return new Response("見つかりませんでした", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  return new Response(renderResearchViewer(found.meta.title, found.json), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "private, no-store",
      "x-robots-tag": "noindex, nofollow",
      "referrer-policy": "no-referrer",
    },
  });
}
