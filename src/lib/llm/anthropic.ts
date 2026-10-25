import { readSSE } from "./sse";
import { LLMError, type GenerateRequest, type LLMProvider } from "./types";

// https://platform.claude.com/docs/en/build-with-claude/streaming
const ENDPOINT = "https://api.anthropic.com/v1/messages";

export class AnthropicProvider implements LLMProvider {
  readonly name = "anthropic";

  constructor(
    private readonly apiKey: string,
    private readonly models: { fast: string; quality: string },
  ) {}

  async *stream(req: GenerateRequest): AsyncIterable<string> {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      signal: req.signal,
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.models[req.tier],
        max_tokens: req.maxTokens ?? 700,
        system: req.system,
        messages: req.messages,
        stream: true,
      }),
    });
    if (!res.ok || !res.body) {
      throw new LLMError(`Anthropic API error: ${res.status} ${await safeText(res)}`, res.status);
    }
    for await (const data of readSSE(res.body)) {
      const event = JSON.parse(data) as {
        type: string;
        delta?: { type: string; text?: string };
        error?: { message?: string };
      };
      if (event.type === "content_block_delta" && event.delta?.type === "text_delta" && event.delta.text) {
        yield event.delta.text;
      } else if (event.type === "error") {
        throw new LLMError(`Anthropic stream error: ${event.error?.message ?? "unknown"}`);
      }
    }
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 300);
  } catch {
    return "";
  }
}
