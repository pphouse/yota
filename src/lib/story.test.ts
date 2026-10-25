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

  it("名前の字が異体字に変わっても、同じ人の台詞にする", () => {
    expect(toBeats("一條「……あ、ありがとう」", ["一条", "久住"])[0]).toMatchObject({ speaker: 0 });
  });

  it("名前の前に言葉がくっついても、末尾の名前を話者にする", () => {
    expect(toBeats("そう言って透「……寝ろ」", duo)).toEqual([
      { kind: "narration", text: "そう言って" },
      { kind: "line", text: "……寝ろ", speaker: 1, open: false },
    ]);
  });

  it("登場人物でない人の台詞は、名前ごと地の文にする", () => {
    expect(toBeats("元部下「城へお戻りを」 透「……誰だ」", duo)).toEqual([
      { kind: "narration", text: "元部下「城へお戻りを」" },
      { kind: "line", text: "……誰だ", speaker: 1, open: false },
    ]);
  });

  it("台詞の中の入れ子の「」で吹き出しを割らない", () => {
    expect(toBeats("透「「ちゃんと言う」じゃ、困るんだよ」", duo)).toEqual([
      { kind: "line", text: "『ちゃんと言う』じゃ、困るんだよ", speaker: 1, open: false },
    ]);
  });

  it("名前に「の」が付いた文は、途中で割らずに1つの地の文にする", () => {
    expect(toBeats("透の「またな」の語尾が、扉の奥に消える。", duo)).toEqual([
      { kind: "narration", text: "透の「またな」の語尾が、扉の奥に消える。" },
    ]);
  });

  it("地の文の前に名前だけが置かれても、名前だけの行は出さない", () => {
    expect(toBeats("透*皿の縁をつまむ* 陽太「なに」", duo)).toEqual([
      { kind: "narration", text: "皿の縁をつまむ" },
      { kind: "line", text: "なに", speaker: 0, open: false },
    ]);
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

  it("ひとりの作品では、文の途中の「…」で吹き出しを分けず『…』にする", () => {
    const solo = ["天城 響"];
    expect(toBeats("俺はいつも、「正解」を見つける側なんで……", solo)).toEqual([
      { kind: "line", text: "俺はいつも、『正解』を見つける側なんで……", speaker: 0 },
    ]);
    expect(toBeats("先輩が「この味好きだな」って呟くのが、目についてました。", ["日向 颯"])).toHaveLength(1);
    // 行の頭・文の終わり・」のあとの「は、これまでどおり台詞の始まり
    expect(toBeats("「……座って」「無理すんな」", ["灰原 湊斗"])).toHaveLength(2);
  });

  it("（…）は補足として分ける", () => {
    expect(toBeats("「そうか」\n\n（ダミー応答です）", ["灰原 湊斗"]).at(-1)).toEqual({ kind: "note", text: "ダミー応答です" });
  });
});
