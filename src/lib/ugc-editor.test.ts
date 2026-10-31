import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { getPlot } from "./characters";
import { emptyDraft, fieldIdCandidates, fromInput, toPayload } from "./create-draft";
import { resetDbForTests } from "./db";
import { buildSystemPrompt } from "./prompt";
import { createUgc, getImage, getUgc, saveImage, setUgcStatus, updateUgc } from "./ugc";
import { pickOptions, readOptions } from "./ugc-assist";
import { toInput } from "./ugc-draft";
import { forTrial, missingItems, PlotInput, toPlot, withDefaults } from "./ugc-schema";
import { fillPlot, fillUser } from "./username";

beforeEach(() => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "yota-editor-"));
  resetDbForTests(`file:${path.join(dir, "test.db")}`);
});

/** 必須の項目だけを書いた作品 */
const minimal = () => ({
  title: "雨宿りの約束",
  viewpoints: ["self"],
  setting: "駅前の古い喫茶店。閉店間際、雨宿りに入った{{user}}に、店主が声をかける。",
  personas: [{ name: "柊 朔", age: 28, personality: "無口だが面倒見がいい", speech: "低い声で短く話す。一人称は俺、相手を{{user}}と呼ぶ" }],
  opening: { self: "*カウンター越しにタオルを差し出す* 濡れたままだと、風邪ひくぞ。{{user}}" },
});

describe("必須の項目と、足りない項目の表示", () => {
  it("必須の項目だけで作れる。空の項目は、作品にするときに補う", () => {
    const r = PlotInput.safeParse(minimal());
    expect(r.success).toBe(true);
    const plot = toPlot("u-test1234", r.data!);
    expect(plot.genres).toEqual(["daily"]);
    expect(plot.intro).toBe(minimal().setting);
    expect(plot.catchphrase).toBe("駅前の古い喫茶店。");
    expect(plot.hooks.length).toBeGreaterThan(0);
    expect(plot.tags.length).toBeGreaterThan(0);
  });

  it("白紙の下書きでは、足りない項目を日本語の名前で返す（同じ項目は1回だけ）", () => {
    const labels = missingItems(toPayload(emptyDraft("self"))).map((m) => m.label);
    expect(labels).toEqual(["題名", "キャラ1の名前", "キャラ1の年齢（18歳以上）", "キャラ1の口調", "舞台・関係", "キャラ1の性格か見た目", "最初の一言（あなたが主人公）"]);
  });

  it("見守りの作品で1人しかいなければ、そう伝える", () => {
    const input = { ...minimal(), viewpoints: ["watch"], opening: { watch: "朔「……」" } };
    expect(missingItems(input).map((m) => m.label)).toContain("ふたりを見守る作品には、登場人物が2人必要です");
  });

  it("足りない項目の場所から、画面の欄の id を近い順に返す", () => {
    expect(fieldIdCandidates("personas.0.examples.1.user")).toEqual([
      "f-personas-0-examples-1-user",
      "f-personas-0-examples-1",
      "f-personas-0-examples",
      "f-personas-0",
      "f-personas",
    ]);
  });

  it("保存してある作品を下書きにして戻すと、そのまま通る", () => {
    for (const id of ["sleepy-prince", "dorm-rivals"]) {
      expect(PlotInput.safeParse(toPayload(fromInput(toInput(getPlot(id)!)))).success).toBe(true);
    }
  });

  it("空のまま補った値は、作品の入力には書き込まない（直すときに空のまま見える）", () => {
    const r = PlotInput.parse(minimal());
    expect(r.catchphrase).toBe("");
    expect(withDefaults(r).catchphrase).not.toBe("");
  });
});

describe("{{user}} と口調の例", () => {
  it("{{user}} を遊ぶ人の名前に、名前がなければ「あなた」にする", () => {
    expect(fillUser("おかえり、{{user}}。｛｛user｝｝も { { user } }", "みお")).toBe("おかえり、みお。みおも { { user } }");
    expect(fillUser("{{ user }}の席", "")).toBe("あなたの席");
    const plot = fillPlot(toPlot("u-test1234", PlotInput.parse(minimal())), "みお");
    expect(plot.opening.self).toContain("風邪ひくぞ。みお");
  });

  it("プロンプトでは {{user}} を名前にし、口調の例を人物の欄に入れる", () => {
    const input = PlotInput.parse({ ...minimal(), personas: [{ ...minimal().personas[0], examples: [{ user: "寒いね", reply: "……これ、着とけ" }] }] });
    const system = buildSystemPrompt({ plot: toPlot("u-test1234", input), viewpoint: "self", isMinor: false, summary: "", userTurns: 1, userName: "みお" });
    expect(system).not.toContain("{{user}}");
    expect(system).toContain("相手をみおと呼ぶ");
    expect(system).toContain("相手「寒いね」→ 朔「……これ、着とけ」");
  });
});

describe("試しに話す", () => {
  it("題名や舞台がまだ空でも、名前・口調・最初の一言があれば話せる", () => {
    const r = forTrial({ ...minimal(), title: "", setting: "", personas: [{ name: "柊 朔", age: "", speech: "短く話す" }] }, "self");
    expect(r.ok).toBe(true);
  });

  it("名前・口調・最初の一言が足りなければ、それを返す", () => {
    const r = forTrial(toPayload(emptyDraft("self")), "self");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.missing.map((m) => m.label)).toEqual(["キャラ1の名前", "キャラ1の口調", "最初の一言（あなたが主人公）"]);
  });
});

describe("AIで考える", () => {
  it("長すぎる案・使えない言葉や外国語の混ざった案・重複は捨てる", () => {
    const options = pickOptions("title", { options: ["放課後の約束", "高校の屋上で", "あ".repeat(31), "放課後の約束", "【雨宿り】の喫茶店", "你是常連"] });
    expect(options).toEqual(["放課後の約束", "雨宿りの喫茶店"]);
  });

  it("閉じ括弧（} や ]）が欠けた出力でも、案の一覧を読む", () => {
    expect(readOptions('\n\n{"options":["雨の夜","朝の駅"]')).toEqual({ options: ["雨の夜", "朝の駅"] });
    expect(readOptions('{"options":["雨の夜","朝の駅"}')).toEqual({ options: ["雨の夜", "朝の駅"] });
    expect(readOptions('{"options":[{"user":"a","reply":"b"}}')).toEqual({ options: [{ user: "a", reply: "b" }] });
    expect(readOptions('はい {"options": ["a"]} どうぞ')).toEqual({ options: ["a"] });
  });

  it("口調の例は、相手の言葉と返事の組で返す", () => {
    const options = pickOptions("examples", { options: [{ user: "おはよう", reply: "……ん。早いな" }, { user: "x" }, "文字だけ"] });
    expect(options).toEqual([{ user: "おはよう", reply: "……ん。早いな" }]);
  });
});

describe("直して保存・キャラの画像", () => {
  it("公開中の作品を直すと確認待ちに戻り、作者が書いたままの入力を読める", async () => {
    const id = await createUgc("s1", "みお", PlotInput.parse(minimal()), "none");
    await setUgcStatus(id, "public");
    const edited = PlotInput.parse({ ...minimal(), title: "雨宿りの約束、ふたたび" });
    await updateUgc(id, edited, { status: "pending" });
    const entry = await getUgc(id);
    expect(entry?.meta.status).toBe("pending");
    expect(entry?.input.title).toBe("雨宿りの約束、ふたたび");
    expect(entry?.input.catchphrase).toBe("");
  });

  it("画像を保存して、場所から読み出せる。作品の face にはその場所だけを入れられる", async () => {
    const url = await saveImage("s1", new Uint8Array([0xff, 0xd8, 0xff, 1]), "image/jpeg");
    expect(url).toMatch(/^\/api\/ugc\/images\/[a-z0-9]{12}$/);
    const image = await getImage(url.split("/").at(-1)!);
    expect(image?.mime).toBe("image/jpeg");
    expect(Array.from(image!.data)).toEqual([0xff, 0xd8, 0xff, 1]);
    const ok = { ...minimal(), personas: [{ ...minimal().personas[0], face: url }] };
    expect(PlotInput.safeParse(ok).success).toBe(true);
    const bad = { ...minimal(), personas: [{ ...minimal().personas[0], face: "https://example.com/a.png" }] };
    expect(PlotInput.safeParse(bad).success).toBe(false);
  });
});
