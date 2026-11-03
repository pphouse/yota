import { describe, expect, it } from "vitest";
import { getPlot } from "./characters";
import { dayPart, describeClock, timeTint } from "./clock";
import { buildSystemPrompt, HOOK_DEADLINE_TURNS, hesitateTurn, hookTurn, innerTurn } from "./prompt";
import { mangaPanels, plainStory, titleOf, toBeats, toBlocks } from "./story";

const solo = ["灰原 湊斗"];
const pair = ["一条 透", "久住 蓮"];

describe("心の声（〈…〉）", () => {
  it("ひとりの作品で、台詞のあとの心の声を、同じ吹き出しの別の項目にする", () => {
    const blocks = toBlocks(toBeats("*顔をそむける* 別に、待ってたわけじゃない\n〈……三時間前から待ってた〉", solo), true);
    expect(blocks).toHaveLength(1);
    const bubble = blocks[0];
    expect(bubble.kind === "bubble" && bubble.items.map((i) => i.kind)).toEqual(["narration", "line", "inner"]);
    expect(bubble.kind === "bubble" && bubble.items.at(-1)).toMatchObject({ kind: "inner", text: "……三時間前から待ってた" });
  });

  it("ふたりの作品で、台詞の行の中の心の声は、その人の吹き出しに入れる", () => {
    const blocks = toBlocks(toBeats("一条「いいから寝ろ」〈心配なんだよ〉\n久住「……はいはい」", pair), false);
    const first = blocks[0];
    expect(first.kind === "bubble" && first.speaker).toBe(0);
    expect(first.kind === "bubble" && first.items.map((i) => i.kind)).toEqual(["line", "inner"]);
    expect(blocks[1].kind === "bubble" && blocks[1].speaker).toBe(1);
  });

  it("〈〉の代わりに <…>・＜…＞・《…》 で書かれても心の声にする。台詞の情景の行（> …）はそのまま", () => {
    for (const raw of ["別に\n<……眠れないって、俺と同じか>", "別に\n＜……眠れないって、俺と同じか＞", "別に\n《……眠れないって、俺と同じか》"]) {
      expect(toBeats(raw, solo).at(-1)).toMatchObject({ kind: "inner", text: "……眠れないって、俺と同じか" });
    }
    expect(toBeats("> 窓の外で雨が強くなった。", solo)).toEqual([{ kind: "scene", text: "窓の外で雨が強くなった。" }]);
    expect(plainStory("別に\n<聞こえてない>")).toBe("別に");
  });

  it("流している途中の閉じていない〈 も、心の声として扱う（中身を先に見せない）", () => {
    const beats = toBeats("知らない\n〈本当は", solo);
    expect(beats.at(-1)).toMatchObject({ kind: "inner", text: "本当は", open: true });
  });
});

describe("山場の見出し（▼）", () => {
  it("最初の行の見出しを取り出し、行が終わるまではカットインを出さない", () => {
    expect(titleOf("▼閉店後、ふたりきり\n*灯を落とす*")).toBe("閉店後、ふたりきり");
    expect(titleOf("▼閉店後、ふた", false)).toBeNull();
    expect(titleOf("▼閉店後、ふたりきり\n", false)).toBe("閉店後、ふたりきり");
    expect(titleOf("*灯を落とす*")).toBeNull();
    expect(toBlocks(toBeats("▼雨の夜\n*傘を差し出す* 入れよ", solo), true)[0]).toEqual({ kind: "title", text: "雨の夜" });
  });
});

describe("書式を外した文章", () => {
  it("言いかけてやめた言葉と見出しを消し、心の声は既定では消して、あらすじでは本音として残す", () => {
    const text = "▼告白未遂\n~~好きだ~~……好きにしろ\n〈言えなかった〉";
    expect(plainStory(text)).toBe("……好きにしろ");
    expect(plainStory(text, { inner: "keep" })).toBe("（場面：告白未遂）\n……好きにしろ\n（本音：言えなかった）");
  });
});

describe("漫画のコマ風カード", () => {
  it("見出し・いちばん長い台詞・心の声を、それぞれのコマに割り当てる。言いかけた言葉は載せない", () => {
    const p = mangaPanels("▼雨の夜\n*傘を差し出す* ~~送ってく~~……入れよ。濡れたまま帰すわけにいかないだろ\n〈もう少し一緒にいたい〉", solo);
    expect(p.narration).toBe("雨の夜");
    expect(p.line?.text).toBe("……入れよ。濡れたまま帰すわけにいかないだろ");
    expect(p.inner?.text).toBe("もう少し一緒にいたい");
  });
});

describe("端末の時刻", () => {
  it("時間帯で画面の色を変え（昼は変えない）、プロンプトに曜日と時刻を書く", () => {
    expect(dayPart(2)).toBe("midnight");
    expect(timeTint(13)).toBeNull();
    expect(timeTint(2)).toContain("linear-gradient");
    expect(describeClock({ hour: 2, minute: 5, weekday: 2 })).toBe("火曜日の深夜2時05分");
  });

  it("時刻があればプロンプトに入れ、深夜は気づかう例を添える。なければ入れない", () => {
    const plot = getPlot("sleepy-prince")!;
    const ctx = { plot, viewpoint: "self" as const, isMinor: false, summary: "", userTurns: 1 };
    expect(buildSystemPrompt({ ...ctx, clock: { hour: 2, minute: 0, weekday: 5 } })).toContain("金曜日の深夜2時00分");
    expect(buildSystemPrompt({ ...ctx, clock: { hour: 2, minute: 0, weekday: 5 } })).toContain("まだ起きてたのか");
    expect(buildSystemPrompt(ctx)).not.toContain("【いまの時間】");
  });
});

describe("プロンプトの書き方の決まり", () => {
  it("心の声と言いかけの書き方を伝え、山場を起こす返答でだけ見出しを求める", () => {
    const plot = getPlot("sleepy-prince")!;
    const base = { plot, viewpoint: "self" as const, isMinor: false, summary: "" };
    const early = buildSystemPrompt({ ...base, userTurns: 1 });
    expect(early).toContain("〈〉（山かっこ。半角の < > ではない）で囲んだ1文");
    expect(early).toContain("~~ ~~ で囲み");
    expect(early).not.toContain("\n【この返答で】\n");
    expect(buildSystemPrompt({ ...base, userTurns: HOOK_DEADLINE_TURNS })).toContain("「▼」に続けて");
  });

  it("どの返答で心の声・言いかけ・山場を入れるかを決め、その返答の最後で指示する", () => {
    const plot = getPlot("sleepy-prince")!;
    const at = (userTurns: number) => buildSystemPrompt({ plot, viewpoint: "self", isMinor: false, summary: "", userTurns });
    expect([1, 2, 3, 4, 5, 6, 7, 8].filter(innerTurn)).toEqual([2, 5, 8]);
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].filter(hesitateTurn)).toEqual([4, 10]);
    expect([1, 2, 3, 4, 5, 6, 7, 8, 11].filter(hookTurn)).toEqual([3, 7, 11]);
    expect(at(2).split("\n【この返答で】\n")[1]).toContain("〈〉で囲んで1つ");
    expect(at(4).split("\n【この返答で】\n")[1]).toContain("~~ ~~ で囲み");
    expect(at(3).split("\n【この返答で】\n")[1]).toContain("「▼」に続けて");
    expect(at(6)).not.toContain("\n【この返答で】\n");
  });
});
