import { describe, expect, it } from "vitest";
import { hasForeignText, stripForeignScripts } from "./japanese";

describe("hasForeignText", () => {
  it("ふつうの日本語は通す（常用外の漢字・大文字の略語・× も）", () => {
    for (const t of [
      "*マグを温める* ……座って。顔色悪いな",
      "呟くように頷いて、綺麗な溜め息をつく",
      "PCは閉じた。CEOの仕事はOKだ",
      "一条×久住",
      "頰が赤い。噓はつけない",
      "★☆♪♡…—「」『』〜！？①㈱ ＡＢＣ 🥺😳👍🏻 ❤️",
    ])
      expect(hasForeignText(t)).toBe(false);
  });

  it("簡体字・ハングル・キリル文字・ベトナム語・小文字の英単語を見つける", () => {
    for (const t of [
      "空调が強すぎる",
      "明灭する森",
      "指、 가까운な",
      "よろしく、 сосед。",
      "rồi、ふと目を伏せて",
      "時計が eleven を指す",
      "マスクの耳挂",
      "欄Hanに置いた手",
      "たまたما目に入った",
      "αの字",
      "こうして風吸えるの、立牌だよ",
    ])
      expect(hasForeignText(t)).toBe(true);
  });
});

describe("stripForeignScripts", () => {
  it("ハングルやキリル文字の語と、小文字の英単語を取り除く", () => {
    expect(stripForeignScripts("よろしく、 сосед。")).toBe("よろしく、 。");
    expect(stripForeignScripts("時計が eleven を指す")).toBe("時計が を指す");
  });
});
