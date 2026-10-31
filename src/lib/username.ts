import { checkText, mentionsSexual } from "./safety";

/** 名前の最大文字数（吹き出しや地の文で読みやすい長さ） */
export const USER_NAME_MAX = 12;

/**
 * ユーザーが決めた名前を整える。物語の書式に使う記号（* 「」 > など）と改行は取り除く。
 * 空になる・長すぎる・安全でない名前は null。
 */
export function normalizeUserName(raw: string): string | null {
  const name = raw
    .normalize("NFC")
    .replace(/[*＊「」『』<>＜＞()（）\[\]【】\\/]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!name || Array.from(name).length > USER_NAME_MAX) return null;
  if (!checkText(name).ok || mentionsSexual(name)) return null;
  return name;
}

/** 地の文（*…*）の中の「あなた」を、ユーザーの名前にする。台詞の「あなた」は呼びかけなので変えない */
export function nameInNarration(text: string, name: string): string {
  if (!name) return text;
  return text.replace(/\*([^*]+)\*/g, (_, body: string) => `*${body.replaceAll("あなた", name)}*`);
}

/** 作品の文章の {{user}}（zeta と同じ書き方）を、遊ぶ人の名前にする。名前がなければ「あなた」 */
export function fillUser(text: string, name: string): string {
  return text.replace(/\{\{\s*user\s*\}\}|｛｛\s*user\s*｝｝/gi, name || "あなた");
}

/** 作品のすべての文章の {{user}} を置き換えた写しを返す */
export function fillPlot<T>(plot: T, name: string): T {
  const walk = (v: unknown): unknown =>
    typeof v === "string"
      ? fillUser(v, name)
      : Array.isArray(v)
        ? v.map(walk)
        : v && typeof v === "object"
          ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]))
          : v;
  return walk(plot) as T;
}

/** 舞台の説明など、地の文だけの文章の「あなた」をユーザーの名前にする */
export function nameInProse(text: string, name: string): string {
  return name ? text.replaceAll("あなた", name) : text;
}
