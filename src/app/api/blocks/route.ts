import { z } from "zod";
import { addBlock, listBlocks, removeBlock } from "@/lib/account";
import { getSession } from "@/lib/session";
import { logEvent } from "@/lib/store";
import { getUgc } from "@/lib/ugc";

/** ブロックしている作者の一覧（設定画面で解除するため） */
export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ items: [] });
  return Response.json({ items: await listBlocks(session.id) });
}

const Body = z.object({ plotId: z.string().max(64) });

/** 作品の作者をブロックする。作者のIDは画面に出さないので、作品のIDで受け取る */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "年齢の確認が必要です" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  const entry = parsed.success ? await getUgc(parsed.data.plotId) : null;
  if (!entry) return Response.json({ error: "作品が見つかりません" }, { status: 404 });
  if (entry.sessionId === session.id) return Response.json({ error: "自分はブロックできません" }, { status: 400 });
  await addBlock(session.id, entry.sessionId, entry.meta.author);
  await logEvent(session.id, "author_block", { plotId: entry.meta.id });
  return Response.json({ ok: true });
}

/** ブロックを解除する（?id=） */
export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "年齢の確認が必要です" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return Response.json({ error: "解除する相手がありません" }, { status: 400 });
  await removeBlock(session.id, id);
  return Response.json({ ok: true });
}
