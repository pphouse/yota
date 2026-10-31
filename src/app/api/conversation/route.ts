import { z } from "zod";
import type { Viewpoint } from "@/lib/characters";
import { getSession } from "@/lib/session";
import { addMessage, createConversation, getLatestConversation, listMessages, logEvent } from "@/lib/store";
import { resolvePlot } from "@/lib/ugc";
import { nameInNarration } from "@/lib/username";

const ViewpointSchema = z.enum(["self", "watch"]);

/** そのキャラ・視点の最新の会話を返す。なければ conversation: null。 */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "年齢の確認が必要です" }, { status: 401 });
  const url = new URL(req.url);
  const plot = await resolvePlot(url.searchParams.get("plotId") ?? "");
  const viewpoint = ViewpointSchema.safeParse(url.searchParams.get("viewpoint"));
  if (!plot || !viewpoint.success || !plot.viewpoints.includes(viewpoint.data)) {
    return Response.json({ error: "作品が見つかりません" }, { status: 404 });
  }
  const conv = await getLatestConversation(session.id, plot.id, viewpoint.data);
  if (!conv) return Response.json({ conversation: null, messages: [] });
  return Response.json({ conversation: { id: conv.id }, messages: await listMessages(conv.id) });
}

const Body = z.object({ plotId: z.string(), viewpoint: ViewpointSchema });

/** 新しい会話を始める。キャラの最初の一言を保存して返す。 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "年齢の確認が必要です" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  const plot = parsed.success ? await resolvePlot(parsed.data.plotId) : undefined;
  if (!parsed.success || !plot || !plot.viewpoints.includes(parsed.data.viewpoint)) {
    return Response.json({ error: "作品が見つかりません" }, { status: 404 });
  }
  const viewpoint: Viewpoint = parsed.data.viewpoint;
  const conv = await createConversation(session.id, plot.id, viewpoint);
  // 当事者視点では、最初の一言の地の文に出てくる「あなた」をユーザーの名前にする
  const opening = plot.opening[viewpoint] ?? "";
  await addMessage(conv.id, "assistant", viewpoint === "self" ? nameInNarration(opening, session.name) : opening);
  await logEvent(session.id, "conversation_start", { plotId: plot.id, viewpoint });
  return Response.json({ conversation: { id: conv.id }, messages: await listMessages(conv.id) });
}
