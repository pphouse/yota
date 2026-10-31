/**
 * 作る画面で書いている途中の作品（下書き）。入力欄にそのままつなげるよう、数や一覧も文字のまま持つ。
 * 保存・確かめのときに toPayload で作品の入力の形（PlotInput）に直す。画面とテストで使う（DBは使わない）。
 */
import type { Genre, StatKey, Viewpoint } from "./characters";
import type { PlotInput } from "./ugc-schema";

export type PersonaDraft = {
  name: string;
  reading: string;
  age: string;
  height: string;
  profile: string;
  personality: string;
  speech: string;
  examples: { user: string; reply: string }[];
  face?: string;
  /** 好き・嫌い・口癖は「、」区切りの文字で持つ */
  likes: string;
  dislikes: string;
  habits: string;
  inLove: string;
  topics?: string[];
  mbti: string;
  stats?: Record<StatKey, number>;
  color?: string;
};

export type Draft = {
  title: string;
  catchphrase: string;
  tags: string[];
  genres: Genre[];
  viewpoints: Viewpoint[];
  personas: PersonaDraft[];
  intro: string;
  prologue: string;
  role: string;
  setting: string;
  opening: { self: string; watch: string };
  starterReplies: { self: string[]; watch: string[] };
  hooks: string[];
};

export const emptyPersona = (): PersonaDraft => ({
  name: "",
  reading: "",
  age: "",
  height: "",
  profile: "",
  personality: "",
  speech: "",
  examples: [],
  likes: "",
  dislikes: "",
  habits: "",
  inLove: "",
  mbti: "",
});

/** 遊び方を選んだときの、空の下書き（見守りは2人から） */
export function emptyDraft(viewpoint: Viewpoint): Draft {
  return {
    title: "",
    catchphrase: "",
    tags: [],
    genres: [],
    viewpoints: viewpoint === "watch" ? ["watch", "self"] : ["self"],
    personas: viewpoint === "watch" ? [emptyPersona(), emptyPersona()] : [emptyPersona()],
    intro: "",
    prologue: "",
    role: "",
    setting: "",
    opening: { self: "", watch: "" },
    starterReplies: { self: [], watch: [] },
    hooks: [],
  };
}

const joinList = (v?: string[]) => (v ?? []).join("、");
const splitList = (s: string, max: number) =>
  s
    .split(/[、,，\n]+/)
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, max);

/** 保存してある作品（またはAIの下書き）を、作る画面の下書きにする */
export function fromInput(input: PlotInput): Draft {
  return {
    title: input.title,
    catchphrase: input.catchphrase,
    tags: input.tags,
    genres: input.genres,
    viewpoints: input.viewpoints,
    personas: input.personas.map((p) => ({
      name: p.name,
      reading: p.reading ?? "",
      age: String(p.age),
      height: p.height ? String(p.height) : "",
      profile: p.profile,
      personality: p.personality,
      speech: p.speech,
      examples: p.examples ?? [],
      face: p.face,
      likes: joinList(p.likes),
      dislikes: joinList(p.dislikes),
      habits: joinList(p.habits),
      inLove: p.inLove ?? "",
      topics: p.topics,
      mbti: p.mbti ?? "",
      stats: p.stats,
      color: p.color,
    })),
    intro: input.intro,
    prologue: input.prologue,
    role: input.role ?? "",
    setting: input.setting,
    opening: { self: input.opening.self ?? "", watch: input.opening.watch ?? "" },
    starterReplies: { self: input.starterReplies.self ?? [], watch: input.starterReplies.watch ?? [] },
    hooks: input.hooks,
  };
}

/** 下書きを、作品の入力の形にする（確かめる前の生の値。空の任意項目は落とす） */
export function toPayload(d: Draft): Record<string, unknown> {
  const t = (s: string) => s.trim();
  const some = (s: string) => (t(s) ? t(s) : undefined);
  const lines = (v: string[]) => v.map(t).filter(Boolean);
  return {
    title: t(d.title),
    catchphrase: t(d.catchphrase),
    tags: lines(d.tags),
    genres: d.genres,
    viewpoints: d.viewpoints,
    personas: d.personas.map((p) => ({
      name: t(p.name),
      reading: some(p.reading),
      // 空なら空のまま送り、「年齢」が足りないと分かるようにする
      age: t(p.age) === "" ? "" : Number(t(p.age).replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))),
      height: some(p.height) ? Number(p.height) : undefined,
      profile: t(p.profile),
      personality: t(p.personality),
      speech: t(p.speech),
      examples: p.examples.map((e) => ({ user: t(e.user), reply: t(e.reply) })).filter((e) => e.user || e.reply),
      face: p.face,
      likes: splitList(p.likes, 5),
      dislikes: splitList(p.dislikes, 5),
      habits: splitList(p.habits, 5),
      inLove: some(p.inLove),
      topics: p.topics,
      mbti: some(p.mbti),
      stats: p.stats,
      color: p.color,
    })),
    intro: t(d.intro),
    prologue: t(d.prologue),
    role: d.viewpoints.includes("self") ? some(d.role) : undefined,
    setting: t(d.setting),
    opening: Object.fromEntries(d.viewpoints.map((v) => [v, some(d.opening[v])])),
    starterReplies: Object.fromEntries(d.viewpoints.map((v) => [v, lines(d.starterReplies[v])])),
    hooks: lines(d.hooks),
  };
}

/** 入力欄の id（足りない項目のチップから、その欄へ飛ぶのに使う） */
export const fieldId = (path: string) => "f-" + path.replaceAll(".", "-");

/** 足りない項目の場所（personas.0.examples.1.user など）から、画面にある一番近い欄の id を順に返す */
export function fieldIdCandidates(path: string): string[] {
  const parts = path.split(".");
  return parts.map((_, i) => fieldId(parts.slice(0, parts.length - i).join(".")));
}

/** 端末に残す下書き。新しく作るときと、作品ごとに分ける */
export const storageKey = (id?: string | null) => (id ? `yota:ugc-edit:${id}` : "yota:ugc-new");

export type Stored = { draft: Draft; savedAt: number };

export function loadStored(key: string): Stored | null {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? "null") as Stored | null;
    return v && v.draft && Array.isArray(v.draft.personas) ? v : null;
  } catch {
    return null;
  }
}

export function saveStored(key: string, draft: Draft): number | null {
  try {
    const savedAt = Date.now();
    localStorage.setItem(key, JSON.stringify({ draft, savedAt }));
    return savedAt;
  } catch {
    return null;
  }
}

export function clearStored(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // 消せなくても困らない
  }
}
