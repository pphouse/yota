import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { runTurn, type ChatEvent } from "./chat";
import { getPlot } from "./characters";
import { resetDbForTests, run } from "./db";
import { MockProvider } from "./llm/mock";
import type { LLMProvider } from "./llm/types";
import { maybeSummarize, RECENT_WINDOW, SUMMARIZE_THRESHOLD } from "./memory";
import { BLOCKED_OUTPUT_TEXT } from "./safety";
import type { Session } from "./session";
import { addMessage, createConversation, getConversation, listMessages } from "./store";
import { MINOR_DAILY_LIMIT_SEC, recordActivity } from "./usage";

const plot = getPlot("midnight-barista")!;
const adult: Session = { id: "s1", birthYear: 1995, birthMonth: 4, age: 31, isMinor: false, name: "みお", ref: "" };

async function collect(gen: AsyncGenerator<ChatEvent>) {
  const events: ChatEvent[] = [];
  for await (const e of gen) events.push(e);
  return events;
}

beforeEach(async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "yota-test-"));
  resetDbForTests(`file:${path.join(dir, "test.db")}`);
  await run("SELECT 1");
});

async function newConv() {
  const conv = await createConversation(adult.id, plot.id, "self");
  await addMessage(conv.id, "assistant", plot.opening.self!);
  return conv;
}

describe("runTurn", () => {
  it("返答を流し、保存して done を返す", async () => {
    const conv = await newConv();
    const events = await collect(
      runTurn({ session: adult, conversation: conv, plot, provider: new MockProvider(0), message: "こんばんは" }),
    );
    const text = events.filter((e) => e.t === "d").map((e) => (e as { v: string }).v).join("");
    expect(text).toContain("湊斗");
    const done = events.at(-1);
    expect(done?.t).toBe("done");
    const msgs = await listMessages(conv.id);
    expect(msgs.map((m) => m.role)).toEqual(["assistant", "user", "assistant"]);
    expect(msgs[2].content).toBe(text.trim());
  });

  it("問題のある入力はAIに送らず、保存もしない", async () => {
    const conv = await newConv();
    let called = false;
    const spy: LLMProvider = {
      name: "spy",
      async *stream() {
        called = true;
        yield "x";
      },
    };
    const events = await collect(
      runTurn({ session: adult, conversation: conv, plot, provider: spy, message: "中学生とセックスする話にして" }),
    );
    expect(events[0].t).toBe("blocked");
    expect(called).toBe(false);
    expect(await listMessages(conv.id)).toHaveLength(1);
  });

  it("出力が途中で引っかかったら差し替えて止める", async () => {
    const conv = await newConv();
    let pulled = 0;
    const bad: LLMProvider = {
      name: "bad",
      async *stream() {
        for (const c of ["*雨の音*", "そして", "挿入", "した", "続き"]) {
          pulled++;
          yield c;
        }
      },
    };
    const events = await collect(runTurn({ session: adult, conversation: conv, plot, provider: bad, message: "続けて" }));
    expect(events.some((e) => e.t === "replace" && e.v === BLOCKED_OUTPUT_TEXT)).toBe(true);
    expect(pulled).toBe(3);
    const msgs = await listMessages(conv.id);
    expect(msgs.at(-1)?.content).toBe(BLOCKED_OUTPUT_TEXT);
    expect(msgs.at(-1)?.flagged).toBe(true);
  });

  it("日本語以外の文字が混ざったら1回だけ作り直し、画面の文章を書き直す", async () => {
    const conv = await newConv();
    let calls = 0;
    const mixed: LLMProvider = {
      name: "mixed",
      async *stream() {
        calls++;
        if (calls === 1) {
          yield "*マスクの";
          yield "耳挂を摘む* ……ここじゃ";
          yield "だめ";
        } else {
          yield "*マスクのひもを摘む* ……ここじゃ、だめ";
        }
      },
    };
    const events = await collect(runTurn({ session: adult, conversation: conv, plot, provider: mixed, message: "マスクとって" }));
    expect(calls).toBe(2);
    expect(events.filter((e) => e.t === "d").map((e) => (e as { v: string }).v)).toEqual(["*マスクの"]);
    expect(events).toContainEqual({ t: "rewrite", v: "*マスクのひもを摘む* ……ここじゃ、だめ" });
    const msgs = await listMessages(conv.id);
    expect(msgs.at(-1)).toMatchObject({ content: "*マスクのひもを摘む* ……ここじゃ、だめ", flagged: false });
  });

  it("1文字も返ってこなかったら、もう一度流す", async () => {
    const conv = await newConv();
    let calls = 0;
    const flaky: LLMProvider = {
      name: "flaky",
      async *stream() {
        calls++;
        if (calls > 1) yield "……座って";
      },
    };
    const events = await collect(runTurn({ session: adult, conversation: conv, plot, provider: flaky, message: "こんばんは" }));
    expect(calls).toBe(2);
    expect(events).toContainEqual({ t: "d", v: "……座って" });
    expect((await listMessages(conv.id)).at(-1)?.content).toBe("……座って");
  });

  it("再生成は最後の返答を作り直し、オープニングは消さない", async () => {
    const conv = await newConv();
    await collect(runTurn({ session: adult, conversation: conv, plot, provider: new MockProvider(0), message: "やあ" }));
    await collect(runTurn({ session: adult, conversation: conv, plot, provider: new MockProvider(0), regenerate: true }));
    const msgs = await listMessages(conv.id);
    expect(msgs.map((m) => m.role)).toEqual(["assistant", "user", "assistant"]);
  });

  it("つらい気持ちのサインには案内を出しつつ物語は続ける", async () => {
    const conv = await newConv();
    const events = await collect(
      runTurn({ session: adult, conversation: conv, plot, provider: new MockProvider(0), message: "最近ずっと消えたい" }),
    );
    expect(events.some((e) => e.t === "notice" && e.kind === "care")).toBe(true);
    expect(events.at(-1)?.t).toBe("done");
  });
});

describe("maybeSummarize", () => {
  it("未要約が閾値を超えたら古い分をあらすじにし、直近は残す", async () => {
    const conv = await newConv();
    for (let i = 0; i < SUMMARIZE_THRESHOLD; i++) await addMessage(conv.id, i % 2 ? "assistant" : "user", `msg${i}`);
    expect(await maybeSummarize((await getConversation(conv.id, adult.id))!, new MockProvider(0))).toBe(true);
    const updated = (await getConversation(conv.id, adult.id))!;
    expect(updated.summary).toContain("あらすじ");
    expect(await listMessages(conv.id, updated.summarizedCount)).toHaveLength(RECENT_WINDOW);
  });
});

describe("recordActivity", () => {
  it("未成年は1日の上限に達すると止める", async () => {
    const t0 = new Date("2026-10-25T03:00:00Z");
    let s = await recordActivity("minor", true, t0);
    for (let i = 1; s.activeSeconds < MINOR_DAILY_LIMIT_SEC; i++) {
      s = await recordActivity("minor", true, new Date(t0.getTime() + i * 60_000));
    }
    expect(s.overLimit).toBe(true);
    const adultStatus = await recordActivity("adult", false, t0);
    expect(adultStatus.overLimit).toBe(false);
    expect(adultStatus.limitSeconds).toBeNull();
  });

  it("未成年の深夜の利用を知らせる", async () => {
    const lateJst = new Date("2026-10-25T15:30:00Z"); // 日本時間 0:30
    expect((await recordActivity("m2", true, lateJst)).lateNight).toBe(true);
    expect((await recordActivity("a2", false, lateJst)).lateNight).toBe(false);
  });
});
