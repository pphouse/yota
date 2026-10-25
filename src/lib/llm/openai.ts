import { readSSE } from "./sse";
import { LLMError, type GenerateRequest, type LLMProvider } from "./types";

// OpenAI互換の Chat Completions（ストリーミング）。OPENAI_BASE_URL で互換APIにも向けられる。
export class OpenAIProvider implements LLMProvider {
  readonly name = "openai";

  constructor(
    private readonly apiKey: string,
    private readonly models: { fast: string; quality: string },
    private readonly baseUrl = "https://api.openai.com/v1",
  ) {}

  async *stream(req: GenerateRequest): AsyncIterable<string> {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      signal: req.signal,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.models[req.tier],
        max_completion_tokens: req.maxTokens ?? 700,
        stream: true,
        messages: [{ role: "system", content: req.system }, ...req.messages],
      }),
    });
    if (!res.ok || !res.body) {
      throw new LLMError(`OpenAI API error: ${res.status} ${(await res.text()).slice(0, 300)}`, res.status);
    }
    for await (const data of readSSE(res.body)) {
      if (data === "[DONE]") return;
      const chunk = JSON.parse(data) as { choices?: { delta?: { content?: string } }[] };
      const text = chunk.choices?.[0]?.delta?.content;
      if (text) yield text;
    }
  }
}
