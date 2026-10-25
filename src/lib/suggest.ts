import type { Plot, Viewpoint } from "./characters";
import { generateText, type LLMProvider } from "./llm";
import { checkText, mentionsSexual, needsCare } from "./safety";
import type { StoredMessage } from "./store";

/** 候補の数と、1つあたりの最大文字数 */
export const SUGGESTION_COUNT = 3;
const MAX_LEN = 40;
/** 候補を考えるときに読ませる直近のメッセージ数 */
const CONTEXT_MESSAGES = 8;

/** 返事の候補を考える係へのシステムプロンプト。キャラを演じる返答とは別に、短く呼ぶ。 */
export function buildSuggestPrompt(ctx: { plot: Plot; viewpoint: Viewpoint; isMinor: boolean; summary: string }): string {
  const { plot, viewpoint, isMinor, summary } = ctx;
  const cast = plot.personas.map((p) => `- 名前：${p.name}（${p.age}歳）　${p.personality}`).join("\n");
  const view =
    viewpoint === "self"
      ? [
          "【視点：当事者】",
          "読者は物語の中にいる「あなた」です。候補は、あなたが次に言う台詞か、次にする行動です。",
          "- 3つの方向を変えてください：素直に応える／少し踏み込む・からかう／行動で返す。",
          "- 台詞は「」を付けずに書きます。行動は *アスタリスク* で囲みます（例：*黙ってうなずく*）。",
        ]
      : [
          "【視点：見守り】",
          "読者は物語に登場せず、登場人物のやり取りを眺めています。候補は「次はこんな展開が見たい」という短い演出の指示です。",
          "- 登場人物の名前を使い、次に起きてほしい出来事や、関係の変化を書いてください（例：透が本音をこぼす）。",
          "- 3つのうち1つは、静かに見守る選択肢にしても構いません。",
        ];
  return [
    `あなたは、対話しながら物語を読むアプリで、読者が次に送る返事の候補を考える係です。作品は『${plot.title}』。`,
    "",
    "【舞台】",
    plot.setting,
    "",
    "【登場人物】",
    cast,
    "",
    ...view,
    "",
    "【書き方】",
    `- 候補を${SUGGESTION_COUNT}つ、1行に1つずつ書きます。番号・記号・説明・前置きは付けません。`,
    "- それぞれ25字以内。直前の場面の流れに沿い、読者が押したくなる言葉にしてください。",
    "- 登場人物は全員18歳以上の成人です。性的な内容や、暴力を肯定する内容は書きません。",
    ...(isMinor ? ["- 読者は18歳未満です。恋愛は心の動きと会話を中心にしてください。"] : []),
    ...(summary ? ["", "【これまでのあらすじ】", summary] : []),
  ].join("\n");
}

/** 直近の場面を、候補を考える係に渡す1つの文章にする */
export function buildSuggestRequest(messages: StoredMessage[], viewpoint: Viewpoint): string {
  const you = viewpoint === "self" ? "あなた" : "読者の希望";
  const scene = messages
    .slice(-CONTEXT_MESSAGES)
    .map((m) => (m.role === "user" ? `【${you}】${m.content}` : m.content))
    .join("\n\n");
  return `【直近の場面】\n${scene}\n\n次に読者が送る返事の候補を${SUGGESTION_COUNT}つ書いてください。`;
}

/** モデルの出力から候補を取り出す。番号や記号、かぎかっこを外し、長すぎるもの・安全でないものを除く */
export function parseSuggestions(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    let s = raw.trim();
    // 箇条書きの記号や番号（「* 」は外すが、*行動* の * は残す）
    s = s.replace(/^(?:[-・•●]|\*(?=\s)|\d+[.)．、:：]|[（(]?\d+[）)]|[①-⑨])\s*/, "").trim();
    // 全体を囲むかぎかっこ・引用符
    s = s.replace(/^[「『"“](.*)[」』"”]$/, "$1").trim();
    if (!s || s.length > MAX_LEN) continue;
    if (/^(候補|返事|例)[0-9０-９]*[:：]?$/.test(s)) continue;
    // 候補はアプリが「次に言うこと」として差し出すので、通常の判定より厳しくする
    if (!checkText(s).ok || mentionsSexual(s) || needsCare(s)) continue;
    if (out.includes(s)) continue;
    out.push(s);
    if (out.length === SUGGESTION_COUNT) break;
  }
  return out;
}

/** 最後のキャラの返答に続く、返事の候補を作る */
export async function suggestReplies(input: {
  plot: Plot;
  viewpoint: Viewpoint;
  isMinor: boolean;
  summary: string;
  messages: StoredMessage[];
  provider: LLMProvider;
  signal?: AbortSignal;
}): Promise<string[]> {
  const text = await generateText(input.provider, {
    system: buildSuggestPrompt(input),
    messages: [{ role: "user", content: buildSuggestRequest(input.messages, input.viewpoint) }],
    tier: "fast",
    maxTokens: 300,
    signal: input.signal,
    purpose: "suggest",
  });
  return parseSuggestions(text);
}
