import { describe, expect, it } from "vitest";
import { getPlot } from "./characters";
import { MockProvider } from "./llm/mock";
import type { GenerateRequest, LLMProvider } from "./llm/types";
import type { StoredMessage } from "./store";
import { buildSuggestPrompt, buildSuggestRequest, parseSuggestions, suggestReplies, SUGGESTION_COUNT } from "./suggest";

const barista = getPlot("midnight-barista")!;
const manzai = getPlot("manzai-roommates")!;
const msg = (role: StoredMessage["role"], content: string, seq: number): StoredMessage => ({
  id: `m${seq}`,
  seq,
  role,
  content,
  flagged: false,
});

describe("parseSuggestions", () => {
  it("番号・記号・全体のかぎかっこを外し、*行動* の印は残す", () => {
    const text = ["1. 「……ありがとう」", "- もう少しここにいてもいい？", "3) *そっと目を合わせる*"].join("\n");
    expect(parseSuggestions(text)).toEqual(["……ありがとう", "もう少しここにいてもいい？", "*そっと目を合わせる*"]);
  });

  it("空行・見出し・長すぎるもの・重複・安全でないものを除き、最大3つにする", () => {
    const text = [
      "候補：",
      "",
      "ありがとう",
      "ありがとう",
      "あ".repeat(60),
      "セックスしよう",
      "また来てもいい？",
      "*うなずく*",
      "四つ目",
    ].join("\n");
    expect(parseSuggestions(text)).toEqual(["ありがとう", "また来てもいい？", "*うなずく*"]);
  });
});

describe("buildSuggestPrompt / buildSuggestRequest", () => {
  it("視点ごとに、何の候補を作るかを指示する", () => {
    const self = buildSuggestPrompt({ plot: barista, viewpoint: "self", isMinor: false, summary: "" });
    const watch = buildSuggestPrompt({ plot: manzai, viewpoint: "watch", isMinor: true, summary: "雨の夜の約束" });
    expect(self).toContain("【視点：当事者】");
    expect(self).toContain("*アスタリスク*");
    expect(watch).toContain("【視点：見守り】");
    expect(watch).toContain("台詞は書きません");
    expect(watch).toContain("読者は18歳未満です");
    expect(watch).toContain("【これまでのあらすじ】\n雨の夜の約束");
  });

  it("直近の場面だけを、誰の発言か分かる形で渡す", () => {
    const messages = Array.from({ length: 12 }, (_, i) => msg(i % 2 ? "user" : "assistant", `発言${i}`, i));
    const req = buildSuggestRequest(messages, "self");
    expect(req).not.toContain("発言0");
    expect(req).toContain("【あなた】発言11");
    expect(req).toContain("発言10");
  });
});

describe("suggestReplies", () => {
  const messages = [msg("assistant", barista.opening.self!, 0), msg("user", "今日は疲れた", 1), msg("assistant", "*顔を上げる*「……座って」", 2)];

  it("ダミー応答でも候補を3つ返す", async () => {
    const out = await suggestReplies({
      plot: barista,
      viewpoint: "self",
      isMinor: false,
      summary: "",
      messages,
      provider: new MockProvider(0),
    });
    expect(out).toHaveLength(SUGGESTION_COUNT);
  });

  it("候補づくり用のプロンプトで呼び、出力を整えて返す", async () => {
    let seen: GenerateRequest | undefined;
    const stub: LLMProvider = {
      name: "stub",
      async *stream(req) {
        seen = req;
        yield "1. 「ありがとう」\n2. 湊斗さんは";
        yield "休まないの？\n3. *カップを受け取る*\n";
      },
    };
    const out = await suggestReplies({ plot: barista, viewpoint: "self", isMinor: false, summary: "", messages, provider: stub });
    expect(out).toEqual(["ありがとう", "湊斗さんは休まないの？", "*カップを受け取る*"]);
    expect(seen?.purpose).toBe("suggest");
    expect(seen?.messages).toHaveLength(1);
    expect(seen?.messages[0].content).toContain("【あなた】今日は疲れた");
  });

  it("1つも取り出せなかったときは、1回だけ作り直す", async () => {
    let calls = 0;
    const flaky: LLMProvider = {
      name: "flaky",
      async *stream() {
        calls++;
        yield calls === 1 ? "" : "ありがとう\nまた来るね\n*うなずく*";
      },
    };
    const out = await suggestReplies({ plot: barista, viewpoint: "self", isMinor: false, summary: "", messages, provider: flaky });
    expect(out).toEqual(["ありがとう", "また来るね", "*うなずく*"]);
    expect(calls).toBe(2);
  });
});
