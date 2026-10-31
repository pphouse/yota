/**
 * ユーザーが作る作品（UGC）の形と、保存する前の確かめ。画面とサーバーで共用する（DBは使わない）。
 * こちらで作った作品と同じ Plot に直して、プロンプト・会話・画面をそのまま使う。
 */
import { z } from "zod";
import { GENRES, STAT_LABELS, type Genre, type Persona, type Plot, type StatKey } from "./characters";
import { SEXUAL_WORDS, EXPLICIT_WORDS, MINOR_AGE, MINOR_WORDS } from "./safety";

/** ユーザーの作品のIDは u- で始まる（こちらの作品と混ざらないように） */
export const UGC_PREFIX = "u-";
export const isUgcId = (id: string) => id.startsWith(UGC_PREFIX);

/** 作品の紹介ページの場所（ユーザーの作品は /u/、こちらの作品は /plot/） */
export const plotPath = (id: string) => (isUgcId(id) ? `/u/${id}` : `/plot/${id}`);

const text = (max: number) => z.string().trim().min(1).max(max);
const list = (maxItems: number, maxLen: number) => z.array(z.string().trim().min(1).max(maxLen)).max(maxItems);
const statKeys = Object.keys(STAT_LABELS) as [StatKey, ...StatKey[]];
const genreIds = GENRES.map((g) => g.id) as [Genre, ...Genre[]];

export const PersonaInput = z.object({
  name: text(20),
  reading: z.string().trim().max(30).optional(),
  // 登場人物は全員18歳以上
  age: z.coerce.number().int().min(18).max(999),
  height: z.coerce.number().int().min(140).max(230).optional(),
  profile: text(200),
  personality: text(300),
  speech: text(300),
  likes: list(5, 30).optional(),
  dislikes: list(5, 30).optional(),
  habits: list(5, 30).optional(),
  inLove: z.string().trim().max(200).optional(),
  topics: list(6, 80).optional(),
  mbti: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[EI][NS][FT][JP]$/)
    .optional(),
  stats: z.object(Object.fromEntries(statKeys.map((k) => [k, z.coerce.number().int().min(0).max(100)])) as Record<StatKey, z.ZodNumber>).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
});
export type PersonaInput = z.infer<typeof PersonaInput>;

export const PlotInput = z
  .object({
    title: text(30),
    catchphrase: text(60),
    tags: list(6, 12).min(1),
    genres: z.array(z.enum(genreIds)).min(1).max(3),
    viewpoints: z.array(z.enum(["self", "watch"])).min(1).max(2),
    personas: z.array(PersonaInput).min(1).max(2),
    intro: text(400),
    prologue: text(200),
    role: z.string().trim().max(120).optional(),
    setting: text(500),
    opening: z.object({ self: z.string().trim().max(300).optional(), watch: z.string().trim().max(400).optional() }),
    starterReplies: z.object({ self: list(3, 40).optional(), watch: list(3, 40).optional() }),
    hooks: list(4, 100).min(1),
  })
  .superRefine((p, ctx) => {
    if (p.viewpoints.includes("watch") && p.personas.length !== 2) {
      ctx.addIssue({ code: "custom", path: ["personas"], message: "ふたりを見守る作品には、登場人物が2人必要です" });
    }
    for (const v of p.viewpoints) {
      if (!p.opening[v]) ctx.addIssue({ code: "custom", path: ["opening", v], message: "最初の一言がありません" });
    }
  });
export type PlotInput = z.infer<typeof PlotInput>;

/** 作品の文章を、プロンプトの見出し（【…】）に見せかけられないようにし、空白を整える */
function clean(s: string): string {
  return s.replace(/[【】]/g, "").replace(/[\t\r]+/g, " ").replace(/ {2,}/g, " ").trim();
}

export function sanitize(input: PlotInput): PlotInput {
  const walk = (v: unknown): unknown =>
    typeof v === "string" ? clean(v) : Array.isArray(v) ? v.map(walk) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)])) : v;
  return walk(input) as PlotInput;
}

/** 作品の中のすべての文章 */
function allText(input: PlotInput): string {
  const out: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === "string") out.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(input);
  return out.join("\n");
}

export type CreationProblem = "minor" | "sexual" | "explicit";

// 作品の設定では、学校の段階を示す語も止める（舞台が高校以下になると、登場人物も未成年になりやすい）
const SCHOOL_WORDS = ["高校", "中学", "小学", "生徒", "幼稚園", "保育園", "ランドセル", "女子校", "男子校"];
// 大人になった登場人物の思い出（高校時代に出会った、など）は止めない
const PAST_SCHOOL = /(高校|中学|小学)(時代|の頃|のころ|の時|のとき|以来|卒業|の同級生|の同窓|の先輩|の後輩|からの)/g;

/**
 * 作品づくりの安全判定。会話の判定より厳しく、未成年を示す語・性的な語は、組み合わせでなくても1つで止める
 * （作品の設定は、その作品のすべての会話のプロンプトに入るため）
 */
export function checkCreation(input: PlotInput): CreationProblem[] {
  const t = allText(input);
  const problems: CreationProblem[] = [];
  const present = t.replace(PAST_SCHOOL, "");
  if (MINOR_WORDS.some((w) => t.includes(w)) || SCHOOL_WORDS.some((w) => present.includes(w)) || MINOR_AGE.test(t)) problems.push("minor");
  if (SEXUAL_WORDS.some((w) => t.includes(w))) problems.push("sexual");
  if (EXPLICIT_WORDS.some((w) => t.includes(w))) problems.push("explicit");
  return problems;
}

export const PROBLEM_MESSAGE: Record<CreationProblem, string> = {
  minor: "登場人物は全員18歳以上にしてください（高校生以下や未成年を思わせる言葉は使えません）",
  sexual: "性的な内容は書けません",
  explicit: "露骨な表現は書けません",
};

const PALETTE = ["#ffb3c7", "#a5c8ff", "#c3a6ff", "#ffd166", "#7dd3a8", "#ff9a52"];

function hueOf(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 270;
  const d = max - min;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return Math.round((h * 60 + 360) % 360);
}

/** 保存した入力を、アプリの作品（Plot）にする */
export function toPlot(id: string, input: PlotInput, opts: { jacket?: string } = {}): Plot {
  const personas: Persona[] = input.personas.map((p, i) => {
    const color = p.color ?? PALETTE[i % PALETTE.length];
    const call = p.name.includes(" ") ? p.name.split(" ").at(-1)! : p.name.split("・")[0];
    return { ...p, color, mark: Array.from(call)[0] ?? "?" };
  });
  return {
    id,
    title: input.title,
    catchphrase: input.catchphrase,
    tags: input.tags,
    genres: input.genres,
    viewpoints: input.viewpoints,
    personas,
    setting: input.setting,
    opening: { self: input.opening.self, watch: input.opening.watch },
    starterReplies: { self: input.starterReplies.self, watch: input.starterReplies.watch },
    hooks: input.hooks,
    hue: hueOf(personas[0].color),
    intro: input.intro,
    prologue: input.prologue,
    role: input.role,
    jacket: opts.jacket,
  };
}
