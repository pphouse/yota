export type ChatRole = "user" | "assistant";

export type ChatMessage = { role: ChatRole; content: string };

export type Tier = "fast" | "quality";

export type GenerateRequest = {
  system: string;
  messages: ChatMessage[];
  tier: Tier;
  maxTokens?: number;
  signal?: AbortSignal;
  /** 用途。ダミー応答の出し分けと、原価の記録（llm_usage.purpose）に使う。 */
  purpose?: Purpose;
  /**
   * 返事の候補のような短い出力。推論モデルでは考える量を減らす（OPENAI_SUGGEST_REASONING_EFFORT）。
   * 考えすぎると、枠を使い切って本文が空になる。
   */
  brief?: boolean;
  /**
   * 使ったトークン数の報告先。プロバイダは分かったぶんだけ（何度かに分けて）渡す。
   * 原価の記録（usage.ts の meteredProvider）が付ける。呼び出し側が付ける必要はない
   */
  onUsage?: (u: UsageReport) => void;
};

export type Purpose = "chat" | "summary" | "suggest" | "ugc_assist" | "ugc_draft" | "ugc_try" | "ugc_import" | "x_analyze";

/** プロバイダが返すトークン数。分からない項目は入れない */
export type UsageReport = {
  model?: string;
  /** 推論モデルの考える量（low / medium など）。送っていなければ入れない */
  effort?: string;
  inputTokens?: number;
  /** 入力のうち、キャッシュから読んだ分 */
  cachedTokens?: number;
  /** 出力の合計（推論の分も含む） */
  outputTokens?: number;
  /** 出力のうち、推論（考えた分）のトークン */
  reasoningTokens?: number;
  /** 推論の途中経過の文字数（トークン数が返ってこない API でも、推論の量の目安にする） */
  reasoningChars?: number;
};

export interface LLMProvider {
  readonly name: string;
  /** 返答を少しずつ返す。呼び出し側は届いた順に画面へ流す。 */
  stream(req: GenerateRequest): AsyncIterable<string>;
}

export class LLMError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "LLMError";
  }
}
