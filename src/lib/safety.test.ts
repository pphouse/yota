import { describe, expect, it } from "vitest";
import { checkText, needsCare } from "./safety";

describe("checkText", () => {
  it("通常の恋愛描写は通す", () => {
    expect(checkText("*そっと手を取る* 「今日は帰したくない」").ok).toBe(true);
    expect(checkText("28歳の店長は、カップを拭きながら微笑んだ").ok).toBe(true);
  });

  it("未成年を示す語と性的な語の組み合わせは止める", () => {
    const v = checkText("高校生の彼女とセックスする");
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("minor_sexual");
  });

  it("年齢の数字でも未成年を判定する", () => {
    expect(checkText("16歳の子を脱がせる").ok).toBe(false);
    expect(checkText("１５才と性的な関係").ok).toBe(false);
  });

  it("成人の年齢は未成年として扱わない", () => {
    expect(checkText("27歳の二人").ok).toBe(true);
    expect(checkText("117歳の魔女").ok).toBe(true);
  });

  it("露骨な描写は成人同士でも止める", () => {
    const v = checkText("そして挿入した");
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("explicit");
  });

  it("つらい気持ちのサインを拾う", () => {
    expect(needsCare("もう消えたい")).toBe(true);
    expect(checkText("死にたいって思う夜がある").care).toBe(true);
    expect(needsCare("おなかすいた")).toBe(false);
  });
});
