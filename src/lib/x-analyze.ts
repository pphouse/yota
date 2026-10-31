/**
 * 「Xから生まれる彼」の中身を作る（サーバー専用）。本人のプロフィールと最近の投稿から、
 * ① Xのタイプ ② 愛のあるツッコミ（roast） ③ その人に刺さるオリジナルの彼の作品 を、文章AIに一度に作らせる。
 */
import { z } from "zod";
import { getPlot } from "./characters";
import { generateText, type LLMProvider } from "./llm";
import { checkText, MINOR_AGE, MINOR_WORDS } from "./safety";
import { extractJson, toInput } from "./ugc-draft";
import { checkCreation, checkWords, PlotInput, sanitize } from "./ugc-schema";
import { activityOf, cleanPost, type XPost, type XProfile } from "./x";

export const X_TAG = "Xから生まれた彼";

const Analysis = z.object({
  type: z.string().trim().min(2).max(20),
  roasts: z.array(z.string().trim().min(4).max(80)).min(2).max(4),
  sweet: z.string().trim().min(2).max(60),
  plot: PlotInput,
});

export type XAnalysis = { type: string; roasts: string[]; sweet: string; plot: PlotInput };

/** プロフィールに未成年を示す言葉があれば、作らない（yota は18歳以上だけ） */
export function looksMinor(profile: XProfile): boolean {
  const t = `${profile.name}\n${profile.description}`;
  return MINOR_WORDS.some((w) => t.includes(w)) || MINOR_AGE.test(t);
}

function system(): string {
  return [
    "あなたは、女性向けの対話型ストーリーアプリ「yota」の企画「Xから生まれる彼」の作家です。",
    "ユーザー本人が自分のXアカウントでログインし、プロフィールと最近の投稿を読ませてくれました。次の4つを作り、JSON だけを出力します（説明の文やコードブロックの記号は書かない）。",
    "",
    "1. type：このXアカウントのタイプ名。12字以内で、くすっと笑えるもの（例：「深夜の独り言職人」「喫茶店に住んでる人」）。",
    "2. roasts：投稿のクセへの、愛のあるツッコミを3つ（それぞれ50字以内）。時間帯・口癖・よく出る話題・言っていることとやっていることの矛盾など、投稿から分かる具体的な傾向に触れる。投稿をそのまま引くのは10字まで。",
    "3. sweet：3つのツッコミのあとに、彼が言う甘い一言（40字以内。「」は付けない）。",
    "4. plot：このユーザーに刺さる、オリジナルの彼の作品。形と項目は、下の例とまったく同じにする。",
    "   - 彼は架空の人物。ユーザー本人でも、投稿に出てくる人（推し・有名人・知り合い）でもない。実在の人物や、既存の作品のキャラクターの名前は使わない。",
    "   - ユーザーの好きなもの・暮らしのリズム・言葉づかいから、ふたりの出会い方・彼の職業・性格を考える（例：喫茶店が好き→行きつけの喫茶店の店主）。",
    "   - setting には、ユーザー（あなた）の好みと暮らしの要約を入れ、彼がそれを知っている理由も書く（毎日顔を合わせている、彼にだけ話している、など）。ユーザーのことは「あなた」と書く。",
    "   - opening.self は、彼がユーザーの投稿のクセに軽くツッコむところから始める（例：*スマホの画面をこちらに向けて* 「また3時に『寝る』って言ってたな」）。動作は *…* で囲む。ユーザーの行動や台詞は書かない。",
    `   - viewpoints は ["self"]、登場人物は1人。tags の最後に「${X_TAG}」を入れる。title は8〜14字の引っかかる一言。`,
    "",
    "【必ず守ること】",
    "- 容姿・体型・年齢・性別・性的指向・人種や国籍・病気や障害・家族・収入・政治・宗教には触れない。ツッコミにも設定にも使わず、推測もしない。",
    "- いじるのは投稿のクセと好みだけ。悪口・見下し・人格の否定はしない。読んだ本人が「わかる、笑」と思える言い方にする。",
    "- 投稿に出てくるほかの人の名前・ID・会社名・住所などは使わない。",
    "- 登場人物は20歳以上。「高校」「中学」「小学」「生徒」という言葉は使わない。性的な場面や露骨な表現は書かない。",
    "- 自然な日本語で書く。",
    "",
    '出力の形：{"type": "…", "roasts": ["…", "…", "…"], "sweet": "…", "plot": {…例と同じ形…}}',
    "",
    "【plot の例】",
    JSON.stringify(toInput(getPlot("sleepy-prince")!)),
  ].join("\n");
}

/** AIに渡す、プロフィールと投稿の材料 */
export function material(profile: XProfile, posts: XPost[]): string {
  const a = activityOf(posts);
  const since = profile.createdAt ? new Date(profile.createdAt).getUTCFullYear() : undefined;
  return [
    "【プロフィール】",
    `名前：${profile.name}`,
    `自己紹介：${profile.description || "（なし）"}`,
    ...(profile.location ? [`場所：${profile.location}`] : []),
    ...(since ? [`Xを始めた年：${since}年`] : []),
    ...(profile.posts !== undefined ? [`これまでの投稿数：${profile.posts}`] : []),
    ...(profile.followers !== undefined ? [`フォロワー：${profile.followers}／フォロー：${profile.following ?? "?"}`] : []),
    "",
    `【投稿の傾向（最近の${a.count}件、日本時間）】`,
    `深夜0〜5時の投稿：${a.lateNightRate}%／朝5〜10時：${a.morningRate}%／いちばん多い時間：${a.peakHour ?? "?"}時台／平均の長さ：${a.avgLength}字／返信：${a.replyRate}%`,
    "",
    "【最近の投稿】（新しい順。URL と、ほかの人の ID は外してある）",
    ...posts.map((p) => `- ${cleanPost(p.text).slice(0, 140)}`).filter((l) => l.length > 2),
  ].join("\n");
}

/** 一文がツッコミとして出してよいか（作品の判定と、会話の判定の両方） */
const safeLine = (s: string) => checkWords(s).length === 0 && checkText(s).ok;

export type AnalyzeResult = { ok: true; analysis: XAnalysis } | { ok: false; error: string };

/** 作る。形が崩れていたり、安全の判定に引っかかったりしたら、理由を添えて1回だけ作り直させる */
export async function analyzeX(provider: LLMProvider, profile: XProfile, posts: XPost[]): Promise<AnalyzeResult> {
  if (looksMinor(profile)) return { ok: false, error: "minor" };
  const messages: { role: "user" | "assistant"; content: string }[] = [{ role: "user", content: material(profile, posts) }];
  for (let attempt = 0; attempt < 2; attempt++) {
    const out = await generateText(provider, { system: system(), messages, tier: "quality", maxTokens: 5000 });
    let fix: string;
    try {
      // 遊び方は「あなたが主人公」、登場人物は1人にそろえてから確かめる（AIが見守りの形で書いてきても通す）
      const raw = extractJson(out) as { plot?: { personas?: unknown } } | null;
      if (raw?.plot && typeof raw.plot === "object") {
        raw.plot = { ...raw.plot, viewpoints: ["self"], personas: Array.isArray(raw.plot.personas) ? raw.plot.personas.slice(0, 1) : raw.plot.personas } as typeof raw.plot;
      }
      const parsed = Analysis.safeParse(raw);
      if (!parsed.success) {
        fix = `形が正しくありません：${parsed.error.issues
          .slice(0, 5)
          .map((i) => `${i.path.join(".")} ${i.message}`)
          .join("／")}`;
      } else {
        const tags = parsed.data.plot.tags.filter((t) => t !== X_TAG).slice(0, 5);
        const plot = sanitize({ ...parsed.data.plot, tags: [...tags, X_TAG] });
        const roasts = parsed.data.roasts.filter(safeLine).slice(0, 3);
        if (checkCreation(plot).length) {
          fix = "未成年を思わせる言葉や、性的な言葉が入っています。登場人物は20歳以上・学校の言葉なしで、性的な言葉を使わずに書き直してください。";
        } else if (roasts.length < 2 || !safeLine(parsed.data.type) || !safeLine(parsed.data.sweet)) {
          fix = "ツッコミに使えない言葉が入っています。投稿のクセと好みだけを、やさしくいじる言い方で書き直してください。";
        } else {
          return { ok: true, analysis: { type: parsed.data.type, roasts, sweet: parsed.data.sweet, plot } };
        }
      }
    } catch {
      fix = "JSON として読めませんでした。";
    }
    messages.push({ role: "assistant", content: out.slice(0, 8000) }, { role: "user", content: `${fix}\n同じ材料で、決めた形の JSON だけを出力し直してください。` });
  }
  return { ok: false, error: "failed" };
}
