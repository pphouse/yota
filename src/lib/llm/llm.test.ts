import { describe, expect, it } from "vitest";
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
