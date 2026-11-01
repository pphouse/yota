import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { query, resetDbForTests } from "./db";
import { costOf, meteredProvider, parsePrices, saveUsage, type UsageRow } from "./llm-usage";
import { createProvider, generateText } from "./llm";
import type { LLMProvider } from "./llm/types";

/** SSE を返す。文字列はそのまま（[DONE] など）、それ以外は JSON にして送る */
function sse(events: (object | string)[]): Response {
  const enc = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      for (const e of events) c.enqueue(enc.encode(`data: ${typeof e === "string" ? e : JSON.stringify(e)}\n\n`));
      c.close();
    },
  });
  return new Response(body, { status: 200 });
}

const req = { system: "s", messages: [{ role: "user" as const, content: "こんばんは" }], tier: "fast" as const, purpose: "chat" as const };

describe("原価の記録（meteredProvider）", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("OpenAI互換：最後のチャンクのトークン数と、推論の文字数を記録する", async () => {
    const bodies: Record<string, unknown>[] = [];
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)));
      return sse([
        { choices: [{ delta: { reasoning: "疲れている様子。" } }] },
        { choices: [{ delta: { content: "……座って" } }] },
        {
          choices: [],
          usage: { prompt_tokens: 1200, completion_tokens: 900, prompt_tokens_details: { cached_tokens: 1000 }, completion_tokens_details: { reasoning_tokens: 850 } },
        },
        "[DONE]",
      ]);
    });
    const rows: UsageRow[] = [];
    const inner = createProvider({
      LLM_PROVIDER: "openai",
      OPENAI_API_KEY: "k",
      OPENAI_BASE_URL: "https://api.cerebras.ai/v1",
      OPENAI_MODEL_FAST: "qwen-3.8-27b",
      OPENAI_REASONING_EFFORT: "medium",
    });
    const text = await generateText(meteredProvider(inner, { sessionId: "s1" }, (r) => rows.push(r)), req);

    expect(text).toBe("……座って");
    // 互換API には、既定では stream_options を送らない（受け付けない API があるため）
    expect(bodies[0]).not.toHaveProperty("stream_options");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      sessionId: "s1",
      purpose: "chat",
      provider: "openai",
      model: "qwen-3.8-27b",
      effort: "medium",
      inputTokens: 1200,
      cachedTokens: 1000,
      outputTokens: 900,
      reasoningTokens: 850,
      reasoningChars: "疲れている様子。".length,
      outputChars: "……座って".length,
      status: "ok",
    });
  });

  it("OpenAI 本家には、使用量を返すよう stream_options を送る", async () => {
    const bodies: Record<string, unknown>[] = [];
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)));
      return sse([{ choices: [{ delta: { content: "x" } }] }, "[DONE]"]);
    });
    await generateText(createProvider({ LLM_PROVIDER: "openai", OPENAI_API_KEY: "k", OPENAI_MODEL_FAST: "m" }), req);
    expect(bodies[0]).toMatchObject({ stream_options: { include_usage: true } });
  });

  it("互換API でも OPENAI_STREAM_USAGE=1 なら stream_options を送る", async () => {
    const bodies: Record<string, unknown>[] = [];
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)));
      return sse([{ choices: [{ delta: { content: "x" } }] }, "[DONE]"]);
    });
    await generateText(
      createProvider({ LLM_PROVIDER: "openai", OPENAI_API_KEY: "k", OPENAI_BASE_URL: "https://api.cerebras.ai/v1", OPENAI_MODEL_FAST: "m", OPENAI_STREAM_USAGE: "1" }),
      req,
    );
    expect(bodies[0]).toMatchObject({ stream_options: { include_usage: true } });
  });

  it("Anthropic：message_start の入力と message_delta の出力をまとめて記録する", async () => {
    vi.stubGlobal("fetch", async () =>
      sse([
        { type: "message_start", message: { usage: { input_tokens: 300, cache_read_input_tokens: 700, output_tokens: 1 } } },
        { type: "content_block_delta", delta: { type: "text_delta", text: "はい" } },
        { type: "message_delta", usage: { output_tokens: 120 } },
      ]),
    );
    const rows: UsageRow[] = [];
    const inner = createProvider({ LLM_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "k" });
    await generateText(meteredProvider(inner, {}, (r) => rows.push(r)), req);
    expect(rows[0]).toMatchObject({ model: "claude-haiku-5-5", inputTokens: 1000, cachedTokens: 700, outputTokens: 120 });
  });

  it("途中で読むのをやめたら stopped、失敗したら error として残す", async () => {
    const rows: UsageRow[] = [];
    const slow: LLMProvider = {
      name: "fake",
      async *stream(r) {
        r.onUsage?.({ model: "m" });
        yield "あ";
        yield "い";
      },
    };
    for await (const chunk of meteredProvider(slow, { purpose: "suggest" }, (r) => rows.push(r)).stream({ ...req, purpose: undefined })) {
      expect(chunk).toBe("あ");
      break; // 安全判定で止めたときと同じ
    }
    const broken: LLMProvider = {
      name: "fake",
      async *stream() {
        throw new Error("boom");
      },
    };
    await expect(generateText(meteredProvider(broken, {}, (r) => rows.push(r)), req)).rejects.toThrow("boom");
    expect(rows.map((r) => [r.purpose, r.status, r.outputChars, r.inputTokens])).toEqual([
      ["suggest", "stopped", 1, null],
      ["chat", "error", 0, null],
    ]);
  });
});

describe("原価の計算", () => {
  it("キャッシュ分は cached の単価、なければ入力の単価で数える", () => {
    const u = { inputTokens: 1_000_000, cachedTokens: 400_000, outputTokens: 500_000 };
    expect(costOf({ input: 1, output: 2, cached: 0.1 }, u)).toBeCloseTo(0.6 + 0.04 + 1);
    expect(costOf({ input: 1, output: 2 }, u)).toBeCloseTo(1 + 1);
    expect(costOf(undefined, u)).toBeNull();
    expect(costOf({ input: 1, output: 2 }, { inputTokens: null, cachedTokens: null, outputTokens: 10 })).toBeNull();
  });

  it("LLM_PRICES が JSON でなければ、単価なしとして扱う", () => {
    expect(parsePrices('{"m":{"input":0.6,"output":1.2}}')).toEqual({ m: { input: 0.6, output: 1.2 } });
    expect(parsePrices("not json")).toEqual({});
    expect(parsePrices(undefined)).toEqual({});
  });
});

describe("記録の保存", () => {
  beforeEach(() => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "yota-usage-"));
    resetDbForTests(`file:${path.join(dir, "test.db")}`);
  });

  it("会話の中身は残さず、数だけを1行で残す", async () => {
    await saveUsage({
      sessionId: "s1",
      purpose: "chat",
      provider: "openai",
      model: "m",
      tier: "fast",
      effort: "medium",
      inputTokens: 10,
      cachedTokens: null,
      outputTokens: 5,
      reasoningTokens: null,
      reasoningChars: 3,
      outputChars: 4,
      costUsd: 0.001,
      ms: 1200,
      status: "ok",
      createdAt: 1,
    });
    const rows = await query<Record<string, unknown>>("SELECT * FROM llm_usage");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ session_id: "s1", purpose: "chat", input_tokens: 10, output_tokens: 5, cached_tokens: null, status: "ok" });
  });
});
