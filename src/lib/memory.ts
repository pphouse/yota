import { generateText, type LLMProvider } from "./llm";
import { buildSummaryPrompt, toApiMessages } from "./prompt";
import { listMessages, setSummary, type Conversation } from "./store";

/** プロンプトにそのまま載せる直近のメッセージ数 */
export const RECENT_WINDOW = 12;
/** 未要約のメッセージがこれを超えたら、古い分をあらすじにまとめる */
export const SUMMARIZE_THRESHOLD = 24;

/**
 * 長期記憶：未要約の会話が増えたら、直近 RECENT_WINDOW 件を残して古い分をあらすじに畳み込む。
 * 返答の速さを落とさないよう、返答を送り終えてから呼ぶ。
 */
export async function maybeSummarize(conv: Conversation, provider: LLMProvider): Promise<boolean> {
  const pending = await listMessages(conv.id, conv.summarizedCount);
  if (pending.length <= SUMMARIZE_THRESHOLD) return false;
  const toFold = pending.slice(0, pending.length - RECENT_WINDOW);
  const summary = await generateText(provider, {
    system: buildSummaryPrompt(conv.summary),
    messages: toApiMessages(toFold.map((m) => ({ role: m.role, content: m.content }))),
    tier: "fast",
    maxTokens: 500,
    purpose: "summary",
  });
  const lastSeq = toFold[toFold.length - 1].seq;
  await setSummary(conv.id, summary.trim(), lastSeq + 1);
  return true;
}
