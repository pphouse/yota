import { z } from "zod";
import { resolvePlot } from "@/lib/ugc";
import { query } from "@/lib/db";
import { getProvider } from "@/lib/llm";
import { getSession } from "@/lib/session";
import { getConversation, listMessages, logEvent } from "@/lib/store";
import { suggestReplies } from "@/lib/suggest";

// 候補づくりも文章AIを呼ぶので、連打で費用が膨らまないよう1分あたりの回数を抑える
const SUGGEST_LIMIT_PER_MIN = Number(process.env.RATE_LIMIT_PER_MIN ?? 20) * 2;

const Body = z.object({
  conversationId: z.string(),
  /** どの返答に対する候補か。最後の返答と違えば（書き直し直後など）作らない */
  messageId: z.string(),
  /** 直近に出した候補（2回分まで）。同じ物や動作を繰り返さないように渡す */
  previous: z.array(z.string().max(60)).max(6).optional(),
});

/** 最後のキャラの返答に続く、返事の候補を返す */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "年齢の確認が必要です" }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "リクエストが正しくありません" }, { status: 400 });
  const conv = await getConversation(parsed.data.conversationId, session.id);
  const plot = conv ? await resolvePlot(conv.plotId) : undefined;
  if (!conv || !plot) return Response.json({ error: "会話が見つかりません" }, { status: 404 });

  const recent = await query<{ n: number }>(
    "SELECT COUNT(*) AS n FROM events WHERE session_id = ? AND type = 'suggest' AND created_at > ?",
    [session.id, Date.now() - 60_000],
  );
  if (Number(recent[0]?.n ?? 0) >= SUGGEST_LIMIT_PER_MIN) return Response.json({ suggestions: [] }, { status: 429 });

  const messages = await listMessages(conv.id, conv.summarizedCount);
  const last = messages.at(-1);
  if (!last || last.role !== "assistant" || last.id !== parsed.data.messageId || last.flagged) {
    return Response.json({ suggestions: [] }, { status: 409 });
  }

  const provider = getProvider();
  const started = performance.now();
  try {
    const suggestions = await suggestReplies({
      plot,
      viewpoint: conv.viewpoint,
      isMinor: session.isMinor,
      userName: session.name,
      summary: conv.summary,
      messages,
      previous: parsed.data.previous,
      provider,
      signal: req.signal,
    });
    await logEvent(session.id, "suggest", {
      plotId: plot.id,
      viewpoint: conv.viewpoint,
      count: suggestions.length,
      ms: Math.round(performance.now() - started),
    });
    return Response.json({ suggestions });
  } catch (err) {
    if (!req.signal.aborted) console.error("[api/suggest]", err);
    return Response.json({ suggestions: [] }, { status: 502 });
  }
}
