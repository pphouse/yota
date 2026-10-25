import { describe, expect, it } from "vitest";
import { parseStory, pickQuote, toBeats } from "./story";

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

describe("toBeats", () => {
  const duo = ["犬飼 陽太", "白石 透"];

  it("ひとりの作品では、括弧のない言葉もそのキャラの台詞にする", () => {
    expect(toBeats("*マグを温める* ……座って。「顔色悪いな」", ["灰原 湊斗"])).toEqual([
      { kind: "narration", text: "マグを温める" },
      { kind: "line", text: "……座って。", speaker: 0 },
      { kind: "line", text: "顔色悪いな", speaker: 0, open: false },
    ]);
  });

  it("ふたりの作品では、名前「…」から話者を決める", () => {
    expect(toBeats("陽太「なあ透」 透「……3回目だぞ」", duo)).toEqual([
      { kind: "line", text: "なあ透", speaker: 0, open: false },
      { kind: "line", text: "……3回目だぞ", speaker: 1, open: false },
    ]);
  });

  it("名前が後ろにある外国風の名前でも話者を決める", () => {
    expect(toBeats("ライナルト「下がれ」", ["ライナルト・ヴァイス", "ノア・エルフェン"])[0]).toMatchObject({ speaker: 0 });
  });

  it("流している途中の閉じていない台詞も台詞として出す", () => {
    expect(toBeats("透「言ったら、お前は", duo)).toEqual([{ kind: "line", text: "言ったら、お前は", speaker: 1, open: true }]);
  });

  it("台詞の途中に行動が挟まっても、続きを同じ人の台詞にする", () => {
    expect(toBeats("透「……3回目だぞ。*ペンで額を叩く* 寝ろ。明日バイトだろ」 陽太「えー」", duo)).toEqual([
      { kind: "line", text: "……3回目だぞ。", speaker: 1, open: false },
      { kind: "narration", text: "ペンで額を叩く" },
      { kind: "line", text: "寝ろ。明日バイトだろ", speaker: 1, open: false },
      { kind: "line", text: "えー", speaker: 0, open: false },
    ]);
  });

  it("（…）は補足として分ける", () => {
    expect(toBeats("「そうか」\n\n（ダミー応答です）", ["灰原 湊斗"]).at(-1)).toEqual({ kind: "note", text: "ダミー応答です" });
  });
});
