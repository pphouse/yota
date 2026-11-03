import { after } from "next/server";
import { z } from "zod";
import { runTurn, type ChatEvent } from "@/lib/chat";
import { resolvePlot } from "@/lib/ugc";
import { query } from "@/lib/db";
import { getProvider } from "@/lib/llm";
import { maybeSummarize } from "@/lib/memory";
import { getSession } from "@/lib/session";
import { getConversation, logEvent } from "@/lib/store";
import { recordActivity } from "@/lib/usage";
import { authEnabled, guestLimit, isLoggedIn, sentMessages } from "@/lib/auth";

const RATE_LIMIT_PER_MIN = Number(process.env.RATE_LIMIT_PER_MIN ?? 20);

const Body = z.object({
  conversationId: z.string(),
  message: z.string().max(2000).optional(),
  regenerate: z.boolean().optional(),
  // 端末の時刻（時間に触れた返事のため。なくても動く）
  clock: z.object({ hour: z.number().int().min(0).max(23), minute: z.number().int().min(0).max(59), weekday: z.number().int().min(0).max(6) }).optional(),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "年齢の確認が必要です" }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "リクエストが正しくありません" }, { status: 400 });
  const conv = await getConversation(parsed.data.conversationId, session.id);
  const plot = conv ? await resolvePlot(conv.plotId) : undefined;
  if (!conv || !plot) return Response.json({ error: "会話が見つかりません" }, { status: 404 });

  // 連打やボットによる費用の暴走を防ぐ（1分あたりの送信数）
  const recent = await query<{ n: number }>(
    `SELECT COUNT(*) AS n FROM messages m JOIN conversations c ON c.id = m.conversation_id
     WHERE c.session_id = ? AND m.role = 'user' AND m.created_at > ?`,
    [session.id, Date.now() - 60_000],
  );
  if (Number(recent[0]?.n ?? 0) >= RATE_LIMIT_PER_MIN) {
    return Response.json({ error: "少し間をあけてから送ってください。", code: "rate_limit" }, { status: 429 });
  }

  // ゲスト（ログインしていない人）は、送れる回数に上限がある。ログインすると、それまでの会話を引き継いで続けられる
  let guestLeft: number | null = null;
  if (authEnabled() && !parsed.data.regenerate && !(await isLoggedIn(session.id))) {
    guestLeft = guestLimit() - (await sentMessages(session.id));
    if (guestLeft <= 0) {
      return Response.json(
        { error: "ゲストで話せる回数を使い切りました。ログインすると、続きを保存して話せます。", code: "login_required" },
        { status: 403 },
      );
    }
  }

  const usage = await recordActivity(session.id, session.isMinor);
  if (usage.overLimit) {
    return Response.json(
      { error: "今日の利用時間の上限（3時間）に達しました。また明日、続きを話しましょう。", code: "daily_limit" },
      { status: 429 },
    );
  }

  const provider = getProvider({ sessionId: session.id });
  const encoder = new TextEncoder();
  let finish!: (done: Extract<ChatEvent, { t: "done" }> | undefined) => void;
  const finished = new Promise<Extract<ChatEvent, { t: "done" }> | undefined>((r) => (finish = r));

  // 返答を送り終えてから、記録とあらすじの更新を行う（返答の速さに影響させない）
  after(async () => {
    const done = await finished;
    if (!done) return;
    await logEvent(session.id, parsed.data.regenerate ? "regenerate" : "chat_send", {
      plotId: plot.id,
      viewpoint: conv.viewpoint,
      provider: provider.name,
      firstTokenMs: done.ms.first === null ? null : Math.round(done.ms.first),
      totalMs: Math.round(done.ms.total),
      flagged: done.flagged,
    });
    await maybeSummarize(conv, provider).catch((err) => console.error("[memory]", err));
  });

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: ChatEvent) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
        } catch {
          // 画面側が接続を切った後は送らない
        }
      };
      if (usage.lateNight) {
        send({ t: "notice", kind: "late_night", message: "夜遅くなってきました。続きはまた明日でも、物語は待っています。" });
      }
      // ゲストの残りが少なくなったら、先に知らせる（今回の送信を数えたあとの残り）
      if (guestLeft !== null && guestLeft - 1 <= 3) {
        send({
          t: "notice",
          kind: "guest",
          message:
            guestLeft - 1 > 0
              ? `ゲストで話せるのは、あと${guestLeft - 1}回です。ログインすると、続きを保存して話し放題になります。`
              : "ゲストで話せるのは、ここまでです。ログインすると、この続きから話せます。",
        });
      }
      let done: Extract<ChatEvent, { t: "done" }> | undefined;
      try {
        for await (const e of runTurn({
          session,
          conversation: conv,
          plot,
          provider,
          message: parsed.data.message,
          regenerate: parsed.data.regenerate,
          clock: parsed.data.clock,
          signal: req.signal,
        })) {
          if (e.t === "done") done = e;
          send(e);
        }
      } catch (err) {
        console.error("[api/chat]", err);
        send({ t: "error", message: "エラーが発生しました。もう一度試してください。" });
      } finally {
        try {
          controller.close();
        } catch {
          // すでに閉じている
        }
        finish(done);
      }
    },
    cancel() {
      finish(undefined);
    },
  });

  return new Response(body, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
      "x-accel-buffering": "no",
    },
  });
}
