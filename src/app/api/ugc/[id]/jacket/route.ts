import { getJacket } from "@/lib/ugc";

/** ユーザーの作品のジャケットの画像。URL に ?v=更新時刻 が付くので、長く持ってよい */
export async function GET(_req: Request, ctx: RouteContext<"/api/ugc/[id]/jacket">) {
  const { id } = await ctx.params;
  const image = await getJacket(id);
  if (!image) return new Response("not found", { status: 404 });
  return new Response(image as BodyInit, {
    headers: { "content-type": "image/webp", "cache-control": "public, max-age=31536000, immutable" },
  });
}
