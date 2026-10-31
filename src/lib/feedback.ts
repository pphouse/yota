/** フィードバックの選択肢（画面と API で共用する） */

/** 会話のあとのひとこと評価（5が最高） */
export const SCORES = [
  { score: 5, emoji: "😍", label: "最高" },
  { score: 4, emoji: "🙂", label: "よい" },
  { score: 3, emoji: "😐", label: "ふつう" },
  { score: 2, emoji: "😕", label: "いまいち" },
  { score: 1, emoji: "😞", label: "よくない" },
] as const;

/** 普段使っている他のキャラチャットアプリと比べて */
export const COMPARE = {
  better: "こっちのほうがいい",
  same: "同じくらい",
  worse: "他のアプリのほうがいい",
  none: "他のアプリは使っていない",
} as const;
export type Compare = keyof typeof COMPARE;

/** ご意見の種類 */
export const NOTE_CATEGORIES = {
  impression: "感想",
  bug: "不具合",
  request: "要望",
  other: "その他",
  report: "通報",
} as const;
export type NoteCategory = keyof typeof NOTE_CATEGORIES;

/** 会話のあとの評価を出すまでに、ユーザーが送る回数 */
export const RATING_AFTER_TURNS = 6;
