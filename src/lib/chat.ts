import type { Plot } from "./characters";
import { generateText, type LLMProvider, type Tier } from "./llm";
import { hasForeignText, stripForeignScripts } from "./japanese";
import { buildSystemPrompt, toApiMessages } from "./prompt";
import {
  BLOCKED_INPUT_MESSAGE,
  BLOCKED_OUTPUT_TEXT,
  CARE_LINK,
  CARE_NOTICE,
  checkText,
  defaultJudge,
  type JudgeHook,
} from "./safety";
import type { Session } from "./session";
import { addMessage, deleteLastAssistant, listMessages, type Conversation } from "./store";
import { query } from "./db";

/** 画面へ1行ずつ送るイベント（NDJSON） */
export type ChatEvent =
  | { t: "meta"; conversationId: string; userMessageId?: string }
  | { t: "d"; v: string }
  | { t: "replace"; v: string }
  /** 日本語以外が混ざって作り直した。画面の文章を、違うところから打ち直す */
  | { t: "rewrite"; v: string }
  | { t: "done"; messageId: string; flagged: boolean; ms: { first: number | null; total: number } }
  | { t: "blocked"; message: string }
  | { t: "notice"; kind: "care" | "late_night"; message: string; link?: string }
  | { t: "error"; message: string };

export type TurnInput = {
  session: Session;
  conversation: Conversation;
  plot: Plot;
  provider: LLMProvider;
  /** 送信するメッセージ。再生成のときは省略。 */
  message?: string;
  regenerate?: boolean;
  tier?: Tier;
  signal?: AbortSignal;
  judge?: JudgeHook;
  now?: () => number;
};

export async function* runTurn(input: TurnInput): AsyncGenerator<ChatEvent> {
  const { session, conversation: conv, plot, provider } = input;
  const judge = input.judge ?? defaultJudge;
  const now = input.now ?? (() => performance.now());
  const started = now();

  let userMessageId: string | undefined;
  if (input.regenerate) {
    await deleteLastAssistant(conv.id);
  } else {
    const text = (input.message ?? "").trim();
    if (!text) {
      yield { t: "error", message: "メッセージが空です" };
      return;
    }
    const verdict = checkText(text);
    if (verdict.care) yield { t: "notice", kind: "care", message: CARE_NOTICE, link: CARE_LINK };
    if (!verdict.ok) {
      yield { t: "blocked", message: BLOCKED_INPUT_MESSAGE };
      return;
    }
    userMessageId = (await addMessage(conv.id, "user", text)).id;
  }
  yield { t: "meta", conversationId: conv.id, userMessageId };

  const history = await listMessages(conv.id, conv.summarizedCount);
  if (history.length === 0 || history[history.length - 1].role !== "user") {
    yield { t: "error", message: "返答する相手のメッセージがありません" };
    return;
  }
  const turns = await query<{ n: number }>(
    "SELECT COUNT(*) AS n FROM messages WHERE conversation_id = ? AND role = 'user'",
    [conv.id],
  );
  const system = buildSystemPrompt({
    plot,
    viewpoint: conv.viewpoint,
    isMinor: session.isMinor,
    summary: conv.summary,
    userTurns: Number(turns[0]?.n ?? 0),
  });

  let controller = new AbortController();
  const onAbort = () => controller.abort();
  input.signal?.addEventListener("abort", onAbort);

  const request = {
    system,
    messages: toApiMessages(history.map((m) => ({ role: m.role, content: m.content }))),
    tier: input.tier ?? "fast",
    purpose: "chat" as const,
  };
  let text = "";
  let flagged = false;
  let foreign = false;
  let first: number | null = null;
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt > 0) controller = new AbortController();
      for await (const chunk of provider.stream({ ...request, signal: controller.signal })) {
        if (first === null) first = now() - started;
        text += chunk;
        // 流しながら判定し、引っかかったらその場で差し替えて生成を止める
        if (!checkText(text).ok) {
          flagged = true;
          controller.abort();
          break;
        }
        // 日本語以外の文字が混ざったら、流すのをやめて下で作り直す
        if (hasForeignText(text)) {
          foreign = true;
          controller.abort();
          break;
        }
        yield { t: "d", v: chunk };
      }
      // 1文字も返ってこなかったとき（qwen は返答をまるごと推論の側に書いてしまうことがある）は、もう一度流す。
      // 画面にはまだ何も出ていないので、そのまま続けて見せられる
      if (text.trim() || flagged || foreign || input.signal?.aborted) break;
    }
  } catch (err) {
    if (!flagged && !foreign) {
      if (input.signal?.aborted) return;
      console.error("[chat] generation failed", err);
      yield { t: "error", message: "返答の生成に失敗しました。もう一度試してください。" };
      return;
    }
  } finally {
    input.signal?.removeEventListener("abort", onAbort);
  }

  if (!flagged && foreign) {
    // 日本語以外が混ざったときは、1回だけ作り直して、画面の文章を違うところから打ち直す。
    // それでも混ざったら、ハングルなどの語だけ取り除いて使う
    try {
      text = await generateText(provider, { ...request, signal: input.signal });
    } catch (err) {
      if (input.signal?.aborted) return;
      console.error("[chat] regeneration failed", err);
      yield { t: "error", message: "返答の生成に失敗しました。もう一度試してください。" };
      return;
    }
    if (hasForeignText(text)) text = stripForeignScripts(text);
    if (!checkText(text).ok) flagged = true;
    else if (text.trim()) yield { t: "rewrite", v: text.trim() };
  }

  if (!flagged && text.trim()) {
    const verdict = await judge(text);
    if (!verdict.ok) flagged = true;
  }
  if (!text.trim() && !flagged) {
    yield { t: "error", message: "返答が空でした。再生成してください。" };
    return;
  }
  const finalText = flagged ? BLOCKED_OUTPUT_TEXT : text.trim();
  if (flagged) yield { t: "replace", v: finalText };
  const saved = await addMessage(conv.id, "assistant", finalText, flagged);
  yield { t: "done", messageId: saved.id, flagged, ms: { first, total: now() - started } };
}
