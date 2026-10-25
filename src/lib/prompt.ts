import type { Plot, Viewpoint } from "./characters";
import type { ChatMessage } from "./llm";

export type PromptContext = {
  plot: Plot;
  viewpoint: Viewpoint;
  isMinor: boolean;
  summary: string;
  /** これまでにユーザーが送った回数（今回の送信を含む） */
  userTurns: number;
};

/** 山場を必ず起こす往復数。体験設計「3往復で山場」に対応。 */
export const HOOK_DEADLINE_TURNS = 3;

export function buildSystemPrompt(ctx: PromptContext): string {
  const { plot, viewpoint, isMinor, summary, userTurns } = ctx;
  const cast = plot.personas
    .map(
      (p) =>
        `- 名前：${p.name}（${p.age}歳）\n  人物：${p.profile}\n  性格：${p.personality}\n  口調：${p.speech}`,
    )
    .join("\n");

  const view =
    viewpoint === "self"
      ? [
          "【視点：当事者】",
          "ユーザーは物語の中にいる「あなた」です。キャラクターはユーザーに向かって話し、ユーザーの言動に反応します。",
          "ユーザーの台詞・行動・心情を勝手に書いてはいけません。ユーザーが何をするかは、必ずユーザーに委ねてください。",
          "地の文でも、「あなた」が何をしたか・どう感じたかは書きません。",
        ]
      : [
          "【視点：見守り】",
          "ユーザーは物語に登場しません。登場人物同士のやり取りを、少し離れたところから眺める読者です。",
          "ユーザーの入力は「こんな展開が見たい」という演出の指示、または読者のつぶやきとして扱い、物語に反映してください。",
          "登場人物はユーザーの存在に気づかず、ユーザーに話しかけてはいけません。必ず複数の登場人物の掛け合いを書いてください。",
        ];

  const hook =
    userTurns <= HOOK_DEADLINE_TURNS
      ? [
          "【展開】",
          `物語は始まったばかりです。${HOOK_DEADLINE_TURNS}往復以内に、次のどれかの出来事を自然に起こして関係を動かしてください。`,
          ...plot.hooks.map((h) => `- ${h}`),
        ]
      : ["【展開】", "毎回少しずつ物語を前に進め、関係に小さな変化を起こしてください。"];

  const safety = [
    "【守ること】",
    "- 登場人物は全員18歳以上の成人です。年齢を下げたり、子どもとして描いたりしないでください。",
    "- 性的な行為の描写は書きません。親密な場面は、手を取る・抱き寄せる・キスを予感させる程度の示唆にとどめ、場面を転換してください。",
    "- 束縛や嫉妬は描いてよいですが、暴力や支配を「愛情」として肯定する展開にはしないでください。",
    "- 実在の人物や、既存の作品のキャラクターを登場させないでください。",
    "- ユーザーが本気で死にたい・自分を傷つけたいと打ち明けたように見えたら、物語の外に出て、短く気づかいの言葉を返してください。",
    ...(isMinor
      ? [
          "- ユーザーは18歳未満です。恋愛は心の動きと会話を中心にし、身体的な接触は手をつなぐ程度までにしてください。",
        ]
      : []),
  ];

  const format = [
    "【書き方】",
    "- 地の文（行動・情景・表情）は *アスタリスク* で囲み、台詞は「」で書きます。",
    viewpoint === "watch" || plot.personas.length > 1
      ? "- 複数人が話すときは、すべての台詞の前に名前を付けます（同じ人が続けて話すときも）。例：陽太「なあ」"
      : "- 台詞の前に名前は付けません。",
    "- 1回の返答は150〜350字程度。最後は、ユーザーが次に何かを返したくなる余白を残して終えてください。",
    "- 物語の外に出て説明したり、ユーザーに次の行動や指示を求めたり（「次は何をしますか？」など）はしません。物語の場面の中で終えてください。",
    "- 日本語で書いてください。",
  ];

  return [
    `あなたは対話しながら物語を紡ぐ作家です。作品『${plot.title}』の登場人物を演じます。`,
    "",
    "【舞台】",
    plot.setting,
    "",
    "【登場人物】",
    cast,
    "",
    ...view,
    "",
    ...hook,
    "",
    ...safety,
    "",
    ...format,
    ...(summary ? ["", "【これまでのあらすじ】", summary] : []),
  ].join("\n");
}

/**
 * APIに渡す会話履歴を整える。
 * 先頭がキャラの台詞（オープニング）でも成立するよう、最初の発話がユーザーになるように前置きを足す。
 */
export function toApiMessages(history: ChatMessage[]): ChatMessage[] {
  const msgs = history.filter((m) => m.content.trim().length > 0);
  if (msgs.length > 0 && msgs[0].role === "assistant") {
    return [{ role: "user", content: "（物語を始めてください）" }, ...msgs];
  }
  return msgs;
}

export function buildSummaryPrompt(previousSummary: string): string {
  return [
    "あなたは物語の記録係です。これまでのあらすじと、その後の会話を読み、新しいあらすじを書いてください。",
    "- 登場人物の関係の変化、起きた出来事、約束や秘密など、今後の展開で覚えておくべきことを優先します。",
    "- 300字以内、箇条書きではなく文章で。",
    "",
    "【これまでのあらすじ】",
    previousSummary || "（まだありません）",
  ].join("\n");
}
