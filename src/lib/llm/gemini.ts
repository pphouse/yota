import { readSSE } from "./sse";
import { LLMError, type GenerateRequest, type LLMProvider } from "./types";

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export class GeminiProvider implements LLMProvider {
  readonly name = "gemini";

  constructor(
    private readonly apiKey: string,
    private readonly models: { fast: string; quality: string },
  ) {}

  async *stream(req: GenerateRequest): AsyncIterable<string> {
    const model = this.models[req.tier];
    const res = await fetch(`${BASE}/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`, {
      method: "POST",
      signal: req.signal,
      headers: { "content-type": "application/json", "x-goog-api-key": this.apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: req.system }] },
        contents: req.messages.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        })),
        generationConfig: { maxOutputTokens: req.maxTokens ?? 700 },
      }),
    });
    if (!res.ok || !res.body) {
      throw new LLMError(`Gemini API error: ${res.status} ${(await res.text()).slice(0, 300)}`, res.status);
    }
    req.onUsage?.({ model });
    for await (const data of readSSE(res.body)) {
      const chunk = JSON.parse(data) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
        usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number; cachedContentTokenCount?: number };
      };
      const u = chunk.usageMetadata;
      if (u) {
        // Gemini は考えた分（thoughts）を出力とは別に数えるので、出力の合計に足す
        req.onUsage?.({
          inputTokens: u.promptTokenCount,
          cachedTokens: u.cachedContentTokenCount,
          outputTokens: (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0),
          reasoningTokens: u.thoughtsTokenCount,
        });
      }
      const parts = chunk.candidates?.[0]?.content?.parts ?? [];
      for (const p of parts) if (p.text) yield p.text;
    }
  }
}
