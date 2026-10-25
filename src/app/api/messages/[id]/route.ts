import { z } from "zod";
import { checkText } from "@/lib/safety";
import { getSession } from "@/lib/session";
import { updateAssistantMessage } from "@/lib/store";

const Body = z.object({ content: z.string().trim().min(1).max(4000) });

/** キャラの返答を手直しする */
export async function PATCH(req: Request, ctx: RouteContext<"/api/messages/[id]">) {
  const session = await getSession();
  if (!session) return Response.json({ error: "年齢の確認が必要です" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "内容が空です" }, { status: 400 });
  if (!checkText(parsed.data.content).ok) {
    return Response.json({ error: "この内容には書き換えられません" }, { status: 422 });
  }
  const { id } = await ctx.params;
  const ok = await updateAssistantMessage(id, session.id, parsed.data.content);
  if (!ok) return Response.json({ error: "メッセージが見つかりません" }, { status: 404 });
  return Response.json({ ok: true });
}
