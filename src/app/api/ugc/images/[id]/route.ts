import { getImage } from "@/lib/ugc";

/** 登録したキャラの画像を返す。中身は変わらないので、長くキャッシュさせる */
export async function GET(_req: Request, ctx: RouteContext<"/api/ugc/images/[id]">) {
  const { id } = await ctx.params;
  const image = /^[a-z0-9]{8,16}$/.test(id) ? await getImage(id) : null;
  if (!image) return new Response("not found", { status: 404 });
  return new Response(new Blob([image.data as BlobPart], { type: image.mime }), {
    headers: { "content-type": image.mime, "cache-control": "public, max-age=31536000, immutable", "x-content-type-options": "nosniff" },
  });
}
