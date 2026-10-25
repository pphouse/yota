import { afterEach, describe, expect, it, vi } from "vitest";
import { createProvider, generateText } from "./index";
import { readSSE } from "./sse";

function streamOf(parts: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({
    start(c) {
      for (const p of parts) c.enqueue(enc.encode(p));
      c.close();
    },
  });
}

describe("readSSE", () => {
  it("チャンクの途中で切れたイベントもつなげて読む", async () => {
    const out: string[] = [];
    for await (const d of readSSE(streamOf(["event: x\ndata: {\"a\"", ":1}\n\nda", "ta: [DONE]\n\n"]))) out.push(d);
    expect(out).toEqual(['{"a":1}', "[DONE]"]);
  });

  it("CRLF区切りにも対応する", async () => {
    const out: string[] = [];
    for await (const d of readSSE(streamOf(["data: one\r\n\r\ndata: two\r\n\r\n"]))) out.push(d);
    expect(out).toEqual(["one", "two"]);
  });
});

describe("createProvider", () => {
  it("キーがなければダミー応答になる", () => {
    expect(createProvider({}).name).toBe("mock");
  });

  it("キーがあるものを自動で選ぶ", () => {
    expect(createProvider({ ANTHROPIC_API_KEY: "k" }).name).toBe("anthropic");
    expect(createProvider({ GEMINI_API_KEY: "k", GEMINI_MODEL_FAST: "m" }).name).toBe("gemini");
  });

  it("明示した提供元に必要な設定がなければ分かりやすく失敗する", () => {
    expect(() => createProvider({ LLM_PROVIDER: "openai", OPENAI_API_KEY: "k" })).toThrow("OPENAI_MODEL_FAST");
  });

  it("ダミー応答は登場人物の名前を使って返す", async () => {
    const p = createProvider({ MOCK_DELAY_MS: "0" });
    const text = await generateText(p, {
      system: "- 名前：灰原 湊斗（28歳）\n",
      messages: [{ role: "user", content: "こんばんは" }],
      tier: "fast",
    });
    expect(text).toContain("湊斗");
    expect(text).toContain("こんばんは");
  });
});

describe("OpenAIProvider（互換API）", () => {
  afterEach(() => vi.unstubAllGlobals());

  /** fetch を差し替え、送った中身を記録して、決まったSSEを返す */
  function stubFetch(events: object[]) {
    const calls: { url: string; body: Record<string, unknown> }[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init.body)) });
      const sse = [...events.map((e) => `data: ${JSON.stringify(e)}\n\n`), "data: [DONE]\n\n"];
      return new Response(streamOf(sse), { status: 200 });
    });
    return calls;
  }

  const env = {
    LLM_PROVIDER: "openai",
    OPENAI_API_KEY: "k",
    OPENAI_BASE_URL: "https://api.cerebras.ai/v1",
    OPENAI_MODEL_FAST: "gpt-oss-120b",
  };
  const req = { system: "s", messages: [{ role: "user" as const, content: "こんばんは" }], tier: "fast" as const };

  it("推論（delta.reasoning）は流さず、本文だけを返す", async () => {
    stubFetch([
      { choices: [{ delta: { role: "assistant" } }] },
      { choices: [{ delta: { reasoning: "ユーザーは疲れている。" } }] },
      { choices: [{ delta: { content: "*顔を上げる* " } }] },
      { choices: [{ delta: { content: "……座って" } }] },
    ]);
    expect(await generateText(createProvider(env), req)).toBe("*顔を上げる* ……座って");
  });

  it("OPENAI_REASONING_EFFORT を設定したときだけ reasoning_effort を送る", async () => {
    const calls = stubFetch([{ choices: [{ delta: { content: "x" } }] }]);
    await generateText(createProvider(env), req);
    await generateText(createProvider({ ...env, OPENAI_REASONING_EFFORT: "low" }), req);
    expect(calls[0].url).toBe("https://api.cerebras.ai/v1/chat/completions");
    expect(calls[0].body).not.toHaveProperty("reasoning_effort");
    expect(calls[1].body).toMatchObject({ model: "gpt-oss-120b", reasoning_effort: "low", stream: true });
  });

  it("推論させるときは、考える分の余裕を max_completion_tokens に足す", async () => {
    const calls = stubFetch([{ choices: [{ delta: { content: "x" } }] }]);
    await generateText(createProvider(env), { ...req, maxTokens: 300 });
    await generateText(createProvider({ ...env, OPENAI_REASONING_EFFORT: "medium" }), { ...req, maxTokens: 300 });
    expect(calls[0].body.max_completion_tokens).toBe(300);
    expect(calls[1].body.max_completion_tokens).toBeGreaterThan(1000);
  });
});
