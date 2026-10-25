import { describe, expect, it } from "vitest";
import { getPlot } from "./characters";
import { buildSystemPrompt, toApiMessages } from "./prompt";

const solo = getPlot("midnight-barista")!;
const duo = getPlot("manzai-roommates")!;

describe("buildSystemPrompt", () => {
  it("当事者視点ではユーザーの言動を勝手に書かないよう指示する", () => {
    const p = buildSystemPrompt({ plot: solo, viewpoint: "self", isMinor: false, summary: "", userTurns: 1 });
    expect(p).toContain("【視点：当事者】");
    expect(p).toContain("勝手に書いてはいけません");
    expect(p).toContain("- 名前：灰原 湊斗（28歳）");
  });

  it("見守り視点ではユーザーに話しかけないよう指示する", () => {
    const p = buildSystemPrompt({ plot: duo, viewpoint: "watch", isMinor: false, summary: "", userTurns: 1 });
    expect(p).toContain("【視点：見守り】");
    expect(p).toContain("ユーザーに話しかけません");
    expect(p).toContain("つぶやきやツッコミの言葉を、登場人物に言わせてはいけません");
  });

  it("山場は1往復目には起こさず、2往復目で兆しを入れ、3往復目で必ず起こす。その後も候補を残す", () => {
    const at = (userTurns: number) => buildSystemPrompt({ plot: solo, viewpoint: "self", isMinor: false, summary: "", userTurns });
    expect(at(1)).not.toContain(solo.hooks[0]);
    expect(at(1)).toContain("大きな出来事は起こさず");
    expect(at(2)).toContain("兆し");
    expect(at(3)).toContain("必ず起こし");
    for (const n of [2, 3, 8]) expect(at(n)).toContain(solo.hooks[0]);
    expect(at(8)).toContain("3〜4往復に1回");
  });

  it("複数人の作品では、台詞の前に付ける名前の表記を固定する", () => {
    const p = buildSystemPrompt({ plot: getPlot("mock-wedding")!, viewpoint: "watch", isMinor: false, summary: "", userTurns: 1 });
    expect(p).toContain("名前は「一条」「久住」の表記だけを使い");
    expect(buildSystemPrompt({ plot: solo, viewpoint: "self", isMinor: false, summary: "", userTurns: 1 })).toContain("台詞は「」で囲まず");
  });

  it("未成年には恋愛表現の制限を追加する", () => {
    const minor = buildSystemPrompt({ plot: solo, viewpoint: "self", isMinor: true, summary: "", userTurns: 1 });
    const adult = buildSystemPrompt({ plot: solo, viewpoint: "self", isMinor: false, summary: "", userTurns: 1 });
    expect(minor).toContain("ユーザーは18歳未満です");
    expect(adult).not.toContain("ユーザーは18歳未満です");
  });

  it("あらすじがあれば載せる", () => {
    const p = buildSystemPrompt({ plot: solo, viewpoint: "self", isMinor: false, summary: "雨の夜に約束をした", userTurns: 9 });
    expect(p).toContain("【これまでのあらすじ】\n雨の夜に約束をした");
  });
});

describe("toApiMessages", () => {
  it("キャラの台詞から始まる履歴の前に、ユーザー側の前置きを足す", () => {
    const out = toApiMessages([
      { role: "assistant", content: "座って" },
      { role: "user", content: "ありがとう" },
    ]);
    expect(out[0].role).toBe("user");
    expect(out).toHaveLength(3);
  });
});

describe("公式キャラ", () => {
  it("全員18歳以上", async () => {
    const { PLOTS } = await import("./characters");
    for (const plot of PLOTS) for (const p of plot.personas) expect(p.age).toBeGreaterThanOrEqual(18);
  });

  it("選べる視点ごとにオープニングと選択肢がある", async () => {
    const { PLOTS } = await import("./characters");
    for (const plot of PLOTS)
      for (const v of plot.viewpoints) {
        expect(plot.opening[v]).toBeTruthy();
        expect(plot.starterReplies[v]?.length).toBeGreaterThan(0);
      }
  });
});
