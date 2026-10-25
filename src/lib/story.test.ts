import { describe, expect, it } from "vitest";
import { parseStory, pickQuote } from "./story";

describe("parseStory", () => {
  it("地の文と台詞を分ける", () => {
    expect(parseStory("*マグを置く* ……座って。*目を伏せる*")).toEqual([
      { kind: "narration", text: "マグを置く" },
      { kind: "speech", text: "……座って。" },
      { kind: "narration", text: "目を伏せる" },
    ]);
  });

  it("流している途中で閉じていない地の文も地の文として扱う", () => {
    expect(parseStory("「待って」 *振り返っ")).toEqual([
      { kind: "speech", text: "「待って」" },
      { kind: "narration", text: "振り返っ" },
    ]);
  });
});

describe("pickQuote", () => {
  it("話者名つきの台詞を優先して拾う", () => {
    expect(pickQuote("*雨が降る* 陽太「透が寝るまで寝えへん」 *笑う*")).toBe("陽太「透が寝るまで寝えへん」");
  });

  it("台詞がなければ本文を短くして使う", () => {
    const q = pickQuote("*" + "あ".repeat(200) + "*", 20);
    expect(q).toHaveLength(20);
    expect(q.endsWith("…")).toBe(true);
  });
});
