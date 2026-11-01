import { AnthropicProvider } from "./anthropic";
import { GeminiProvider } from "./gemini";
import { MockProvider } from "./mock";
import { OpenAIProvider } from "./openai";
import { meteredProvider } from "../llm-usage";
import type { GenerateRequest, LLMProvider, Purpose } from "./types";

export type { ChatMessage, GenerateRequest, LLMProvider, Purpose, Tier, UsageReport } from "./types";

type Env = Record<string, string | undefined>;

/**
 * 環境変数から文章AIを選ぶ。
 * LLM_PROVIDER を指定しなければ、キーが設定されているものを Anthropic → OpenAI → Gemini の順に使い、
 * どれもなければダミー応答になる。
 */
export function createProvider(env: Env = process.env): LLMProvider {
  const choice = (env.LLM_PROVIDER ?? "auto").toLowerCase();
  const pick = (name: string) => choice === name || (choice === "auto" && hasKey(env, name));

  if (pick("anthropic")) {
    return new AnthropicProvider(required(env, "ANTHROPIC_API_KEY"), {
      fast: env.ANTHROPIC_MODEL_FAST ?? "claude-haiku-5-5",
      quality: env.ANTHROPIC_MODEL_QUALITY ?? "claude-sonnet-5-5",
    });
  }
  if (pick("openai")) {
    return new OpenAIProvider(
      required(env, "OPENAI_API_KEY"),
      { fast: required(env, "OPENAI_MODEL_FAST"), quality: env.OPENAI_MODEL_QUALITY ?? required(env, "OPENAI_MODEL_FAST") },
      {
        baseUrl: env.OPENAI_BASE_URL,
        reasoningEffort: env.OPENAI_REASONING_EFFORT,
        briefReasoningEffort: env.OPENAI_SUGGEST_REASONING_EFFORT,
        // 原価の記録で、互換APIがトークン数を返さないときは 1 にする（stream_options.include_usage を送る）
        streamUsage: env.OPENAI_STREAM_USAGE ? env.OPENAI_STREAM_USAGE === "1" : undefined,
      },
    );
  }
  if (pick("gemini")) {
    return new GeminiProvider(required(env, "GEMINI_API_KEY"), {
      fast: required(env, "GEMINI_MODEL_FAST"),
      quality: env.GEMINI_MODEL_QUALITY ?? required(env, "GEMINI_MODEL_FAST"),
    });
  }
  return new MockProvider(Number(env.MOCK_DELAY_MS ?? 12));
}

function hasKey(env: Env, name: string): boolean {
  return Boolean(env[`${name.toUpperCase()}_API_KEY`]);
}

function required(env: Env, key: string): string {
  const v = env[key];
  if (!v) throw new Error(`環境変数 ${key} が設定されていません`);
  return v;
}

let cached: LLMProvider | undefined;

/**
 * 文章AIを返す。呼び出しはすべて原価の記録（llm_usage）に残る。
 * sessionId を渡すと、ユーザーごとの原価が分かる。purpose は、呼び出し側で用途を付けていないときの用途
 */
export function getProvider(ctx: { sessionId?: string | null; purpose?: Purpose } = {}): LLMProvider {
  cached ??= createProvider();
  return meteredProvider(cached, ctx);
}

/** ストリーミングせずに全文がほしいとき（要約など）。 */
export async function generateText(provider: LLMProvider, req: GenerateRequest): Promise<string> {
  let out = "";
  for await (const chunk of provider.stream(req)) out += chunk;
  return out;
}
