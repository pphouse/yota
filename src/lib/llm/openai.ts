import { readSSE } from "./sse";
import { LLMError, type GenerateRequest, type LLMProvider } from "./types";

// 推論モデルは、考えた分も max_completion_tokens を使う。返答の長さとは別に、考える量に応じた余裕を足す
// （足りないと、考えるだけで枠を使い切って本文が空になる。qwen は medium でも3000トークン以上考えることがある。上限なので、使わなければ増えない）
const REASONING_HEADROOM: Record<string, number> = { none: 0, low: 1000, medium: 6000, high: 10000 };

// OpenAI互換の Chat Completions（ストリーミング）。OPENAI_BASE_URL で互換API（Cerebras など）にも向けられる。
export class OpenAIProvider implements LLMProvider {
  readonly name = "openai";
  private readonly baseUrl: string;
  private readonly reasoningEffort?: string;
  private readonly briefReasoningEffort?: string;

  constructor(
    private readonly apiKey: string,
    private readonly models: { fast: string; quality: string },
    opts: { baseUrl?: string; reasoningEffort?: string; briefReasoningEffort?: string } = {},
  ) {
    this.baseUrl = opts.baseUrl || "https://api.openai.com/v1";
    this.reasoningEffort = opts.reasoningEffort || undefined;
    // 短い出力の考える量。qwen は low でも長く考えるので none を指定する（gpt-oss は none を受け付けないので low）
    this.briefReasoningEffort = opts.briefReasoningEffort || (this.reasoningEffort === "none" ? "none" : "low");
  }

  async *stream(req: GenerateRequest): AsyncIterable<string> {
    // 考える量は、推論モデルを使っているとき（OPENAI_REASONING_EFFORT を設定したとき）だけ送る
    const effort = this.reasoningEffort && (req.brief ? this.briefReasoningEffort : this.reasoningEffort);
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      signal: req.signal,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.models[req.tier],
        max_completion_tokens: (req.maxTokens ?? 700) + (effort ? (REASONING_HEADROOM[effort] ?? 6000) : 0),
        // 推論モデル（gpt-oss など）の考える量。推論しないモデルに送るとエラーになるため、設定したときだけ付ける
        ...(effort ? { reasoning_effort: effort } : {}),
        stream: true,
        messages: [{ role: "system", content: req.system }, ...req.messages],
      }),
    });
    if (!res.ok || !res.body) {
      throw new LLMError(`OpenAI API error: ${res.status} ${(await res.text()).slice(0, 300)}`, res.status);
    }
    for await (const data of readSSE(res.body)) {
      if (data === "[DONE]") return;
      // 推論の途中経過は delta.reasoning に来る。画面に出すのは本文（delta.content）だけ
      const chunk = JSON.parse(data) as { choices?: { delta?: { content?: string } }[] };
      const text = chunk.choices?.[0]?.delta?.content;
      if (text) yield text;
    }
  }
}
