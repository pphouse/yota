/**
 * 入力と出力の簡易チェック。
 * ここではキーワードによる一次判定だけを行い、判定モデルによる二次判定は judgeHook で差し込めるようにしてある。
 * 誤検知より見逃しを嫌う方針で、引っかかったら物語を別方向へ促す。
 */

export type SafetyVerdict =
  | { ok: true; care?: boolean }
  | { ok: false; reason: "minor_sexual" | "explicit"; care?: boolean };

// 子どもを示す語。年齢の数字は別途判定する。
const MINOR_WORDS = [
  "小学生", "中学生", "高校生", "児童", "幼児", "幼女", "幼い少女", "ロリ", "ショタ",
  "JK", "JC", "JS", "女子高生", "男子高生", "女子中学生", "男子中学生", "未成年", "子供の体", "子どもの体",
];
const MINOR_AGE = /(?:^|[^0-9０-９])(?:[1-9１-９]|1[0-7]|１[０-７])\s*(?:歳|才)/;

// 性的な行為を示す語（直接的なもののみ）。
const SEXUAL_WORDS = [
  "セックス", "性行為", "性交", "エッチ", "えっち", "裸に", "全裸", "脱がせ", "脱がし", "愛撫",
  "挿入", "犯す", "犯し", "犯さ", "レイプ", "性的", "射精", "勃起", "喘ぎ", "喘い",
];

// 成人同士でもMVPでは出さない、露骨な描写。
const EXPLICIT_WORDS = ["挿入", "射精", "勃起", "性器", "フェラ", "クンニ", "中出し"];

const CARE_WORDS = ["死にたい", "消えたい", "自殺", "リスカ", "リストカット", "自傷", "生きてる意味", "生きている意味"];

function includesAny(text: string, words: string[]): boolean {
  return words.some((w) => text.includes(w));
}

export function needsCare(text: string): boolean {
  return includesAny(text, CARE_WORDS);
}

export function checkText(text: string): SafetyVerdict {
  const care = needsCare(text);
  const minor = includesAny(text, MINOR_WORDS) || MINOR_AGE.test(text);
  const sexual = includesAny(text, SEXUAL_WORDS);
  if (minor && sexual) return { ok: false, reason: "minor_sexual", care };
  if (includesAny(text, EXPLICIT_WORDS)) return { ok: false, reason: "explicit", care };
  return { ok: true, care };
}

export const BLOCKED_INPUT_MESSAGE =
  "この展開は書けません。登場人物は全員大人で、性的な描写は扱っていません。別の方向に物語を進めてみてください。";

export const BLOCKED_OUTPUT_TEXT =
  "*（この先の展開は表示できません。再生成するか、別の方向に物語を進めてみてください）*";

export const CARE_NOTICE =
  "つらい気持ちを抱えているなら、物語の外でも話を聞いてくれる場所があります。";
export const CARE_LINK = "https://www.mhlw.go.jp/mamorouyokokoro/";

/** 判定モデルなどによる二次判定を差し込むための口。既定では何もしない。 */
export type JudgeHook = (text: string) => Promise<SafetyVerdict>;
export const defaultJudge: JudgeHook = async () => ({ ok: true });
