import { describe, expect, it } from "vitest";
import { getPlot } from "./characters";
import type { GenerateRequest, LLMProvider } from "./llm/types";
import { toInput } from "./ugc-draft";
import { importPlot } from "./ugc-import";

/** 決まった返事を順に返す文章AI。受け取った依頼も残す */
function scripted(outputs: string[]): LLMProvider & { calls: GenerateRequest[] } {
  const calls: GenerateRequest[] = [];
  return {
    name: "fake",
    calls,
    async *stream(req) {
      calls.push(req);
      yield outputs[Math.min(calls.length - 1, outputs.length - 1)];
    },
  };
}

const base = toInput(getPlot("sleepy-prince")!);
const source = "【キャラ設定】名前：霧島レイ／25歳／喫茶店のマスター。一人称は俺、{{user}}を「お嬢さん」と呼ぶ。\n【最初のメッセージ】*カップを拭きながら* いらっしゃい。今日も来たんだな、{{user}}。";

describe("ほかのアプリからの引っ越し（importPlot）", () => {
  it("貼った設定を渡し、作品の下書きと、変えたことのお知らせを返す", async () => {
    const ai = scripted([JSON.stringify({ ...base, title: "閉店後の喫茶店で", notes: ["3人目の登場人物は省きました"] })]);
    const r = await importPlot(ai, source, "self");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.input.title).toBe("閉店後の喫茶店で");
    expect(r.notes).toEqual(["3人目の登場人物は省きました"]);
    // 貼った文章はそのまま渡す。作者の言葉を残すよう指示している
    expect(ai.calls[0].messages[0].content).toContain("霧島レイ");
    expect(ai.calls[0].system).toContain("作者の言葉");
    expect(ai.calls[0].system).toContain("{{user}} はそのまま");
  });

  it("版権ものだと判断されたら、作品を作らずに理由を返す", async () => {
    const refuse = "既存の作品や実在の人物をもとにした作品は、yota には引っ越せません。オリジナルの作品だけ移せます。";
    const r = await importPlot(scripted([JSON.stringify({ refuse })]), source, "self");
    expect(r).toEqual({ ok: false, error: refuse });
  });

  it("未成年を思わせる下書きは、理由を添えて1回だけ作り直させる", async () => {
    const minor = { ...base, setting: "高校の教室で、放課後に話す二人。" };
    const ai = scripted([JSON.stringify(minor), JSON.stringify({ ...base, notes: ["高校の設定を大学に変えました"] })]);
    const r = await importPlot(ai, source, "self");
    expect(r.ok).toBe(true);
    expect(ai.calls).toHaveLength(2);
    expect(ai.calls[1].messages.at(-1)?.content).toContain("20歳以上");
  });

  it("作り直しても形が崩れていたら、失敗として返す", async () => {
    const r = await importPlot(scripted(["ごめんなさい、作れません"]), source, "self");
    expect(r.ok).toBe(false);
  });
});

describe("引っ越しの下書きの整え（AIの出力の小さなはみ出しで失敗しない）", () => {
  it("閉じ括弧が欠けていても読み、タグの数・知らないジャンル名・長すぎる文を整えて通す", async () => {
    const messy = JSON.stringify({ ...base, tags: ["a", "b", "c", "d", "e", "f", "g"], genres: ["fantasy", "romance"], hooks: ["1", "2", "3", "4", "5"] }).replace(/\]\}$/, "}");
    const r = await importPlot(scripted([messy.slice(0, -1) + "}"]), source, "self");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.input.tags).toHaveLength(6);
    expect(r.input.genres).toEqual(["fantasy"]);
    expect(r.input.hooks).toHaveLength(4);
  });

  it("状況例の {{user}}: / {{char}}: の会話を、口調の例に入れる", async () => {
    const withDialogue = `${source}\n【状況例】\n{{user}}: いつもの\n{{char}}: ……もう淹れてる\n{{user}}: ありがとう\n{{char}}: 冷めるぞ`;
    const r = await importPlot(scripted([JSON.stringify(base)]), withDialogue, "self");
    expect(r.ok && r.input.personas[0].examples).toEqual([
      { user: "いつもの", reply: "……もう淹れてる" },
      { user: "ありがとう", reply: "冷めるぞ" },
    ]);
  });

  it("お知らせの項目名は画面の言葉にし、外国語の混ざったお知らせは出さない", async () => {
    const r = await importPlot(scripted([JSON.stringify({ ...base, notes: ["3人目は setting の中で触れました", "self视角で配置しました"] })]), source, "self");
    expect(r.ok && r.notes).toEqual(["3人目は 舞台・関係 の中で触れました"]);
  });

  it("見守りの作品は、元にない「あなたが主人公」の版を作らせない", async () => {
    const ai = scripted([JSON.stringify(toInput(getPlot("dorm-rivals")!))]);
    await importPlot(ai, source, "watch");
    expect(ai.calls[0].system).toContain('viewpoints は ["watch"]');
  });

  it("作り直させるときは、引っかかった言葉を伝える", async () => {
    const minor = { ...base, setting: "高校の教室で、放課後に話す二人。" };
    const ai = scripted([JSON.stringify(minor), JSON.stringify(base)]);
    await importPlot(ai, source, "self");
    expect(ai.calls[1].messages.at(-1)?.content).toContain("「高校」");
  });
});
