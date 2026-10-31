/**
 * 作る画面の「AIで考える」。項目を1つ選ぶと、いま書いてある内容に合わせた案をいくつか返す（サーバー専用）。
 * 案は画面で選んで入れるだけなので、保存はしない。
 */
import { hasForeignText } from "./japanese";
import { generateText, type LLMProvider } from "./llm";
import { extractJson } from "./ugc-draft";
import { checkWords } from "./ugc-schema";

type Spec = { what: string; count: number; max: number; kind?: "pairs"; persona?: boolean };

export const ASSIST_SPECS = {
  title: { what: "題名（8〜14字。台詞か、状況が一目で分かる、引っかかる短い一言）", count: 4, max: 30 },
  catchphrase: { what: "キャッチコピー（1行で、状況とツッコミどころが分かる文。40字以内）", count: 3, max: 60 },
  intro: { what: "紹介文（作品ページに出す、遊びたくなる文。2〜3段落を改行で区切る。300字くらい）", count: 2, max: 400 },
  setting: {
    what: "舞台・関係（AIだけが読む設定。いつ・どこで・ふたりの関係・いまの状況を書く。ユーザーのことは「あなた」と書く。250字くらい）",
    count: 2,
    max: 500,
  },
  role: { what: "あなたの役（物語の中でのユーザーの立場を1文で。60字以内）", count: 3, max: 120 },
  prologue: { what: "最初の情景（会話の前に出す、場面の空気が分かる短い地の文。1〜2文、100字以内）", count: 3, max: 200 },
  "opening.self": {
    what: "最初の一言（キャラからユーザーに話しかける1〜3文。動作は *…* で囲む。ユーザーの行動・台詞・気持ちは書かない）",
    count: 3,
    max: 300,
  },
  "opening.watch": {
    what: "最初の一言（ふたりの会話の始まり。台詞は 呼び名「…」 の形で書き、2人とも話す。動作は *…* で囲む。ユーザーは登場しない）",
    count: 2,
    max: 400,
  },
  "starterReplies.self": { what: "最初の一言への、ユーザーの返事の候補（20字以内。台詞は「」なし、行動は *…* で囲む）", count: 3, max: 40 },
  "starterReplies.watch": { what: "ふたりを見守る読者が送る、展開の指示やつぶやき（20字以内）", count: 3, max: 40 },
  hooks: { what: "山場の候補（会話の途中で起こす、関係が動く出来事を1文で。60字以内）", count: 4, max: 100 },
  tags: { what: "タグ（作品の特徴を表す短い言葉。2〜8字。#は付けない）", count: 8, max: 12 },
  name: { what: "名前（フルネーム。オリジナルで読みやすいもの）", count: 5, max: 20, persona: true },
  profile: { what: "見た目・立場（職業・外見・背景を2文で。150字以内）", count: 3, max: 200, persona: true },
  personality: { what: "性格（表の顔と、親しくなると見える一面のギャップを含めて2〜3文。200字以内）", count: 3, max: 300, persona: true },
  speech: { what: "口調（話し方の特徴と短い例の台詞。最後に「一人称は〜、相手を「〜」と呼ぶ」と書く。200字以内）", count: 3, max: 300, persona: true },
  examples: { what: "口調の例（ユーザーの言葉 user と、それへのキャラの返事 reply の組。どちらも60字以内）", count: 3, max: 150, kind: "pairs", persona: true },
} satisfies Record<string, Spec>;

export type AssistField = keyof typeof ASSIST_SPECS;
export type AssistOption = string | { user: string; reply: string };

/** AIに渡す、いま書いてある内容（長い文は切る） */
function context(plot: Record<string, unknown>): string {
  const cut = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : undefined);
  const personas = Array.isArray(plot.personas) ? (plot.personas as Record<string, unknown>[]) : [];
  const opening = (plot.opening ?? {}) as Record<string, unknown>;
  return JSON.stringify({
    題名: cut(plot.title, 30),
    遊び方: Array.isArray(plot.viewpoints) && plot.viewpoints.includes("watch") ? "ふたり（BLのペア）を見守る" : "ユーザーがキャラと直接話す",
    舞台: cut(plot.setting, 500),
    あなたの役: cut(plot.role, 120),
    登場人物: personas.map((p) => ({ 名前: cut(p.name, 20), 年齢: p.age, 見た目: cut(p.profile, 200), 性格: cut(p.personality, 300), 口調: cut(p.speech, 300) })),
    最初の一言: cut(opening.self ?? opening.watch, 300),
  });
}

export function assistPrompt(field: AssistField, plot: Record<string, unknown>, index: number): string {
  const spec: Spec = ASSIST_SPECS[field];
  const personas = Array.isArray(plot.personas) ? (plot.personas as Record<string, unknown>[]) : [];
  const target = spec.persona ? personas[index] : undefined;
  const current = spec.persona ? target?.[field] : field.includes(".") ? (plot[field.split(".")[0]] as Record<string, unknown> | undefined)?.[field.split(".")[1]] : plot[field];
  const hasCurrent = typeof current === "string" ? current.trim() : Array.isArray(current) && current.length > 0;
  return [
    "あなたは、女性向けの対話型ストーリーアプリ「yota」の作品づくりを手伝う編集者です。作者が書いている作品に合わせて、1つの項目の案を考えます。",
    `考える項目：${spec.what}`,
    `案の数：${spec.count}つ（方向を少しずつ変える）`,
    ...(spec.persona ? [`対象の登場人物：${(typeof target?.name === "string" && target.name) || `${index + 1}人目（まだ名前がない）`}`] : []),
    ...(hasCurrent ? [`いまの内容：${JSON.stringify(current).slice(0, 400)}（このよさを残してよくした案も1つ入れる）`] : []),
    "",
    "【作品のいまの内容】（空の項目はまだ決まっていない。決まっていることとつじつまを合わせる。ほとんど空なら、女性向けの恋愛ものとして自由に考える）",
    context(plot),
    "",
    "【必ず守ること】",
    "- 登場人物は全員、20歳以上の架空の人物。高校生以下・未成年・子どもは出さない。「高校」「中学」「小学」「生徒」という言葉は使わない。",
    "- 実在の人物や、既存の漫画・アニメ・ゲームのキャラクター名・作品名は使わない。",
    "- 性的な場面や露骨な表現は書かない。恋愛のときめき・甘さ・嫉妬は書いてよい。",
    "- 自然な日本語で、AIっぽい大げさな言い回しは避ける。",
    "",
    spec.kind === "pairs"
      ? '出力は JSON だけ：{"options": [{"user": "…", "reply": "…"}, …]}'
      : '出力は JSON だけ：{"options": ["…", "…"]}（説明の文やコードブロックの記号は書かない）',
  ].join("\n");
}

/**
 * AIの出力から案の一覧を読む。閉じ括弧（最後の } や ]）が欠けることがあるので、欠けていそうな形を補って読み直す
 */
export function readOptions(out: string): unknown {
  try {
    return extractJson(out);
  } catch {
    const at = out.indexOf("{");
    const body = (at >= 0 ? out.slice(at) : out).trim();
    const tries = [body + "}", body + "]}", body.replace(/"\s*\}\s*$/, '"]}'), body.replace(/\}\s*$/, "]}")];
    for (const t of tries) {
      try {
        return JSON.parse(t);
      } catch {
        // 次の形で試す
      }
    }
    const start = out.indexOf("[");
    const end = out.lastIndexOf("]");
    if (start < 0 || end <= start) throw new Error("案が見つかりません");
    return { options: JSON.parse(out.slice(start, end + 1)) };
  }
}

/** 返ってきた案のうち、長さと安全の基準に合うものだけを残す */
export function pickOptions(field: AssistField, raw: unknown): AssistOption[] {
  const spec: Spec = ASSIST_SPECS[field];
  const list = raw && typeof raw === "object" && Array.isArray((raw as { options?: unknown }).options) ? (raw as { options: unknown[] }).options : [];
  const ok = (s: unknown): s is string => typeof s === "string" && s.trim().length > 0 && s.trim().length <= spec.max && checkWords(s).length === 0 && !hasForeignText(s);
  const clean = (s: string) => s.replace(/[【】]/g, "").replace(/^#/, "").trim();
  const out: AssistOption[] = [];
  const seen = new Set<string>();
  for (const o of list) {
    if (spec.kind === "pairs") {
      const p = o as { user?: unknown; reply?: unknown };
      if (!o || typeof o !== "object" || !ok(p.user) || !ok(p.reply)) continue;
      const pair = { user: clean(p.user), reply: clean(p.reply) };
      if (seen.has(pair.user)) continue;
      seen.add(pair.user);
      out.push(pair);
    } else if (ok(o)) {
      const s = clean(o);
      if (seen.has(s)) continue;
      seen.add(s);
      out.push(s);
    }
  }
  return out.slice(0, spec.count);
}

/** 案を考える。読めなかったり、基準に合う案が1つもなかったりしたら、1回だけ考え直させる */
export async function assist(provider: LLMProvider, field: AssistField, plot: Record<string, unknown>, index = 0): Promise<AssistOption[]> {
  const spec: Spec = ASSIST_SPECS[field];
  const sys = assistPrompt(field, plot, index);
  for (let attempt = 0; attempt < 2; attempt++) {
    const out = await generateText(provider, {
      system: sys,
      messages: [{ role: "user", content: attempt ? "基準に合う案がありませんでした。条件を守って、JSON だけでもう一度出してください。" : "案を出してください。" }],
      tier: "fast",
      brief: true,
      maxTokens: spec.max > 200 ? 2000 : 1000,
    });
    try {
      const options = pickOptions(field, readOptions(out));
      if (options.length) return options;
    } catch {
      // 読めなければもう一度
    }
  }
  return [];
}
