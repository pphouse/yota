import { after } from "next/server";
import { run } from "./db";
import type { GenerateRequest, LLMProvider, Purpose, UsageReport } from "./llm/types";

/**
 * 文章AIの原価の記録。呼び出し1回ごとに、用途・モデル・トークン数・かかった時間を llm_usage に残す。
 * 会話の中身は残さない。集計は scripts/cost.mts（npm run cost）。
 *
 * 単価は環境変数 LLM_PRICES（100万トークンあたりの米ドル）で入れる。入れていなければ cost_usd は NULL にして、
 * 集計のときに --prices で渡せるようにしておく。
 *   LLM_PRICES='{"qwen-3.8-27b":{"input":0.6,"output":1.2}}'
 *   キャッシュの単価が違うときは "cached" も入れる（なければ input と同じ）
 */

export type Price = { input: number; output: number; cached?: number };
export type Prices = Record<string, Price>;

export type UsageRow = {
  sessionId: string | null;
  purpose: string;
  provider: string;
  model: string;
  tier: string;
  effort: string;
  inputTokens: number | null;
  cachedTokens: number | null;
  outputTokens: number | null;
  reasoningTokens: number | null;
  reasoningChars: number;
  outputChars: number;
  costUsd: number | null;
  ms: number;
  /** ok：最後まで返った / stopped：途中で止めた（安全判定・ユーザーの中断）/ error：失敗 */
  status: "ok" | "stopped" | "error";
  createdAt: number;
};

export function parsePrices(raw: string | undefined): Prices {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw) as Prices;
    return v && typeof v === "object" ? v : {};
  } catch {
    console.error("[llm-usage] LLM_PRICES を JSON として読めませんでした");
    return {};
  }
}

/** 1回の呼び出しの原価（米ドル）。単価かトークン数が分からなければ null */
export function costOf(price: Price | undefined, u: Pick<UsageRow, "inputTokens" | "cachedTokens" | "outputTokens">): number | null {
  if (!price || u.inputTokens == null || u.outputTokens == null) return null;
  const cached = Math.min(u.cachedTokens ?? 0, u.inputTokens);
  const fresh = u.inputTokens - cached;
  return (fresh * price.input + cached * (price.cached ?? price.input) + u.outputTokens * price.output) / 1_000_000;
}

let prices: Prices | undefined;
function currentPrices(): Prices {
  prices ??= parsePrices(process.env.LLM_PRICES);
  return prices;
}

export async function saveUsage(r: UsageRow): Promise<void> {
  await run(
    `INSERT INTO llm_usage (session_id, purpose, provider, model, tier, effort, input_tokens, cached_tokens, output_tokens,
       reasoning_tokens, reasoning_chars, output_chars, cost_usd, ms, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      r.sessionId,
      r.purpose,
      r.provider,
      r.model,
      r.tier,
      r.effort,
      r.inputTokens,
      r.cachedTokens,
      r.outputTokens,
      r.reasoningTokens,
      r.reasoningChars,
      r.outputChars,
      r.costUsd,
      r.ms,
      r.status,
      r.createdAt,
    ],
  );
}

/** 返事を返し終えてから書く（返答の速さを落とさない）。リクエストの外（テストなど）ではそのまま書く */
function persist(row: UsageRow): void {
  const write = () => saveUsage(row).catch((err) => console.error("[llm-usage] 記録できませんでした", err));
  try {
    after(write);
  } catch {
    void write();
  }
}

export type UsageSink = (row: UsageRow) => void;

/**
 * 呼び出しを記録する文章AI。中身の文章AIはそのまま使い、終わったとき（途中で止めたときも）に1行残す。
 * sessionId：誰の呼び出しか（ユーザーごとの原価を見るため）。purpose：呼び出し側が付けていないときの用途
 */
export function meteredProvider(
  inner: LLMProvider,
  ctx: { sessionId?: string | null; purpose?: Purpose } = {},
  sink: UsageSink = persist,
): LLMProvider {
  return {
    name: inner.name,
    async *stream(req: GenerateRequest): AsyncIterable<string> {
      const usage: UsageReport = {};
      const onUsage = (u: UsageReport) => {
        for (const [k, v] of Object.entries(u)) if (v !== undefined) (usage as Record<string, unknown>)[k] = v;
        req.onUsage?.(u);
      };
      const started = Date.now();
      let outputChars = 0;
      let status: UsageRow["status"] = "stopped";
      try {
        for await (const chunk of inner.stream({ ...req, purpose: req.purpose ?? ctx.purpose, onUsage })) {
          outputChars += chunk.length;
          yield chunk;
        }
        status = "ok";
      } catch (err) {
        status = req.signal?.aborted ? "stopped" : "error";
        throw err;
      } finally {
        const model = usage.model ?? "";
        const row: UsageRow = {
          sessionId: ctx.sessionId ?? null,
          purpose: req.purpose ?? ctx.purpose ?? "other",
          provider: inner.name,
          model,
          tier: req.tier,
          effort: usage.effort ?? "",
          inputTokens: usage.inputTokens ?? null,
          cachedTokens: usage.cachedTokens ?? null,
          outputTokens: usage.outputTokens ?? null,
          reasoningTokens: usage.reasoningTokens ?? null,
          reasoningChars: usage.reasoningChars ?? 0,
          outputChars,
          costUsd: null,
          ms: Date.now() - started,
          status,
          createdAt: started,
        };
        row.costUsd = costOf(currentPrices()[model], row);
        sink(row);
      }
    },
  };
}
