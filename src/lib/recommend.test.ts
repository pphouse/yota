import { describe, expect, it } from "vitest";
import { PLOTS } from "./characters";
import { recommend, STARTER_PICKS } from "./recommend";

describe("あなたにおすすめ", () => {
  it("まだ遊んでいない人には、入口の作品を出す", () => {
    expect(recommend(PLOTS, []).map((p) => p.plot.id)).toEqual(STARTER_PICKS);
    expect(recommend(PLOTS, []).every((p) => p.because === undefined)).toBe(true);
  });

  it("遊んだ作品は出さず、同じカテゴリの作品を理由つきで出す", () => {
    const picks = recommend(PLOTS, ["sleepy-prince"]);
    expect(picks.map((p) => p.plot.id)).not.toContain("sleepy-prince");
    // 学園ものの作品が上に来る
    expect(picks[0].plot.genres).toContain("campus");
    expect(picks[0].because?.id).toBe("sleepy-prince");
  });

  it("最近遊んだ作品ほど重く見る", () => {
    // 直前に見守り（ファンタジー）を遊んだなら、見守りのファンタジーが先に来る
    const picks = recommend(PLOTS, ["knight-and-mage", "puppy-junior"]);
    expect(picks[0].plot.genres).toContain("fantasy");
    expect(picks[0].because?.id).toBe("knight-and-mage");
  });

  it("数が足りなければ入口の作品で埋め、同じ作品を2回出さない", () => {
    const picks = recommend(PLOTS, PLOTS.map((p) => p.id).filter((id) => !STARTER_PICKS.includes(id)));
    const ids = picks.map((p) => p.plot.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(STARTER_PICKS.length);
  });

  it("知らない作品IDは無視する", () => {
    expect(recommend(PLOTS, ["no-such-plot"]).map((p) => p.plot.id)).toEqual(STARTER_PICKS);
  });
});
