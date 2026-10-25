export type ChatRole = "user" | "assistant";

export type ChatMessage = { role: ChatRole; content: string };

export type Tier = "fast" | "quality";

export type GenerateRequest = {
  system: string;
  messages: ChatMessage[];
  tier: Tier;
  maxTokens?: number;
  signal?: AbortSignal;
  /** 用途。実プロバイダは無視し、ダミー応答の出し分けにだけ使う。 */
  purpose?: "chat" | "summary" | "suggest";
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
