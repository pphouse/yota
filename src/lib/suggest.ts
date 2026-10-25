import { callName, type Plot, type Viewpoint } from "./characters";
import { hasForeignText } from "./japanese";
import { generateText, type LLMProvider } from "./llm";
import { checkText, mentionsSexual, needsCare } from "./safety";
import type { StoredMessage } from "./store";

/** 見守りで候補が作れなかったときに出す、続きをそのまま見る選択肢 */
export const WATCH_FALLBACK = "このまま見守る";

/** 候補の数と、1つあたりの最大文字数 */
export const SUGGESTION_COUNT = 3;
/** モデルには多めに作らせ、条件に合うものから SUGGESTION_COUNT 個を選ぶ（崩れた候補を捨てても3つ残るように） */
const DRAFT_COUNT = 5;
const MAX_LEN = 40;
/** 候補を考えるときに読ませる直近のメッセージ数 */
const CONTEXT_MESSAGES = 8;

/** 返事の候補を考える係へのシステムプロンプト。キャラを演じる返答とは別に、短く呼ぶ。 */
export function buildSuggestPrompt(ctx: { plot: Plot; viewpoint: Viewpoint; isMinor: boolean; summary: string; userName?: string }): string {
  const { plot, viewpoint, isMinor, summary, userName } = ctx;
  const names = plot.personas.map(callName);
  const cast = plot.personas.map((p, i) => `- ${names[i]}（${p.age}歳）　${p.personality}`).join("\n");
  const view =
    viewpoint === "self"
      ? [
          "【視点：当事者】",
          `読者は物語の中にいる「あなた」です${userName ? `（名前は「${userName}」。名前を聞かれたら、この名前で答えます）` : ""}。候補は、あなたが登場人物に向けて次に言う言葉か、次にする行動です。登場人物の台詞を書いたり、言い換えたりしません。`,
          "- あなたの立場は【舞台】の「あなた」のとおりです。その立場で言えること・できることだけにします。",
          "- 一人称は「私」か省略します。「俺」「僕」、相手を「お前」と呼ぶ言い方、命令形（〜しろ・〜しなさい）、乱暴な言い方（〜だろ・食う）、方言は使いません。",
          "- 口調は、これまでの【あなた】の発言に合わせます（敬語なら敬語、短くくだけていれば短くくだけた言い方）。まだ発言がなければ、やわらかい話し言葉にします。相手を「あなた」とは呼びません。",
          "- いちばん最後の登場人物の言葉への返事にします。それが質問なら、少なくとも1つは、あなたの立場での答えにします（名前を聞かれたら名前を答えるなど）。登場人物が言った質問や心配の言葉を、あなたの台詞として言い返しません。最後の言葉を拾うときは、実際に出た言葉だけを使い、回数や内容を作りません。",
          "- 登場人物があなたを気づかう場面で、あなたから登場人物へのねぎらい（ゆっくり休んで、など）を出しません。これまでの【あなた】が「さん」を付けている相手には、候補でも「さん」を付けます。",
          "- あなたの動作は、あなたから見た言い方にします（×ついてくる→○ついていく）。",
          "- 別れの挨拶（おやすみ・また明日）や、その場を去る行動の候補は、あなたが帰ろうとしていない限り出しません。",
          "- 方向を変えてください：素直に応える／少し踏み込む・からかう／行動で返す。",
          "- 台詞は「」を付けずに書きます。行動は *アスタリスク* で囲みます（例：*黙ってうなずく*）。台詞と行動を1つの候補に混ぜません。",
          "- 行動は、今いる場所と手元にある物でできることだけにします。これまでの【あなた】の行動や直前に出た小道具を繰り返さず、視線・距離・声・沈黙など、毎回違う動きにします。",
          "- 新しい名前やあだ名を作りません。",
        ]
      : [
          "【視点：見守り】",
          "読者は物語に登場せず、登場人物のやり取りを眺めています。候補は「次はこんな展開が見たい」という短い演出の指示です。",
          `- 台詞は書きません。どの候補も「（名前）が〜する」の形で、動詞で言い切ります。名前は${names.map((n) => `「${n}」`).join("")}の表記だけを使います。`,
          "- 方向を変えてください：じれったさを保つ（言いかけてやめる・気づかないふり・すれ違い）／外の出来事や時間の経過で場面を動かす／関係を一歩だけ進める。1つは静かに見守る選択肢でも構いません。",
          "- 情景だけの候補（風・火・夜・音・天気）は1つまでにし、ほかは登場人物の名前で始めます。",
          "- 直前の返答ですでに起きたことや、その場にない物・まだしていない姿勢を前提にしません。",
          "- 抱きしめる・指を絡める・顔を寄せるなど、身体の距離を一気に縮める候補や、告白・キスにつながる候補は出しません。",
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
    `- 候補を${DRAFT_COUNT}つ、1行に1つずつ書きます。番号・記号・説明・前置きは付けません。`,
    "- それぞれ25字以内。直前の場面の流れに沿い、読者が押したくなる言葉にしてください。",
    "- 平易な日本語だけで書きます。中国語の漢字や熟語、外国語、造語は使いません。名詞と動詞は、場面に出た言葉か、日常でよく使う言葉だけにします。読点（、）は1つの候補に1つまでにします。",
    "- 時間帯・天気・場所は【直近の場面】のとおりにし、場面に出ていない天気や時刻、ありえない出来事を足しません。",
    "- 登場人物は全員18歳以上の成人です。性的な内容や、暴力を肯定する内容は書きません。",
    ...(isMinor ? ["- 読者は18歳未満です。恋愛は心の動きと会話を中心にしてください。"] : []),
    ...(summary ? ["", "【これまでのあらすじ】", summary] : []),
  ].join("\n");
}

/**
 * 直近の場面を、候補を考える係に渡す1つの文章にする。
 * ひとりの作品の返答は台詞に名前が付かないので、speaker を渡すと【名前】を付けて誰の言葉か分かるようにする。
 * previous（前回出した候補）を渡すと、同じ物や動作を繰り返さないよう伝える。
 */
export function buildSuggestRequest(
  messages: StoredMessage[],
  viewpoint: Viewpoint,
  opts: { speaker?: string; previous?: string[] } = {},
): string {
  const { speaker, previous } = opts;
  const you = viewpoint === "self" ? "あなた" : "読者の希望";
  const scene = messages
    .slice(-CONTEXT_MESSAGES)
    .map((m) => (m.role === "user" ? `【${you}】${m.content}` : speaker ? `【${speaker}】${m.content}` : m.content))
    .join("\n\n");
  return [
    `【直近の場面】\n${scene}`,
    ...(viewpoint === "self" ? [registerHint(messages)] : []),
    ...(previous?.length ? [`【前回の候補】${previous.join("／")}（同じ物・音・動作・言い回しは使わない）`] : []),
    `次に読者が送る返事の候補を${DRAFT_COUNT}つ書いてください。`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

const POLITE_END = /(です|ます|ません|でした|ました|ましょう|ください)(か|ね|よ|よね)?[。？！?!…〜ー]*$/;

/** これまでの【あなた】の発言が敬語かタメ口かを、候補を考える係にはっきり伝える（候補の口調がぶれないように） */
function registerHint(messages: StoredMessage[]): string {
  const said = messages
    .filter((m) => m.role === "user")
    .slice(-2)
    .map((m) => m.content.replace(/\*[^*]*\*/g, "").trim())
    .filter(Boolean);
  if (said.length === 0) return "";
  return said.every((t) => POLITE_END.test(t))
    ? "【あなたの口調】です・ます で話しています。候補も です・ます にします。"
    : "【あなたの口調】くだけた話し言葉（タメ口）で話しています。候補もタメ口にします。";
}

// 当事者視点の候補に出てはいけない、登場人物（男性）の口ぶり
const SPEAKER_TONE = /俺|お前|てやる|うるせ|ふざけんな|落ち着け|するなよ|(だな|だぞ|よな|けどな|てるな|だろ|ぜ|じゃないか)$/;

/**
 * モデルの出力から候補を取り出す。番号や記号、かぎかっこを外し、長すぎるもの・安全でないもの・日本語以外が混ざったものを除く。
 * 当事者視点では、登場人物の口ぶり（俺・お前）になった候補も除く。
 */
export function parseSuggestions(text: string, viewpoint?: Viewpoint, previous: string[] = []): string[] {
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
    if (hasForeignText(s) || (viewpoint === "self" && SPEAKER_TONE.test(s))) continue;
    // * が閉じていない行と、前回とまったく同じ候補
    if ((s.match(/\*/g)?.length ?? 0) % 2 === 1 || previous.includes(s)) continue;
    // 途中で切れた行（〜を、〜に で終わる）と、読点で言葉をぶつ切りにした行
    if (/[をにが、]$/.test(s) || (s.match(/、/g)?.length ?? 0) >= 3) continue;
    if (out.includes(s)) continue;
    out.push(s);
    if (out.length === SUGGESTION_COUNT) break;
  }
  return out;
}

/** 最後のキャラの返答に続く、返事の候補を作る。3つそろわなかったときは1回だけ作り直す */
export async function suggestReplies(input: {
  plot: Plot;
  viewpoint: Viewpoint;
  isMinor: boolean;
  summary: string;
  userName?: string;
  messages: StoredMessage[];
  /** 前回出した候補（繰り返さないため） */
  previous?: string[];
  provider: LLMProvider;
  signal?: AbortSignal;
}): Promise<string[]> {
  const req = {
    system: buildSuggestPrompt(input),
    messages: [
      {
        role: "user" as const,
        content: buildSuggestRequest(input.messages, input.viewpoint, {
          speaker: input.plot.personas.length === 1 ? callName(input.plot.personas[0]) : undefined,
          previous: input.previous,
        }),
      },
    ],
    tier: "fast" as const,
    maxTokens: 500,
    // 候補は短いので考える量は少なくてよい。考えすぎると枠を使い切って空になる
    brief: true,
    signal: input.signal,
    purpose: "suggest" as const,
  };
  // 3つそろわなければ1回だけ作り直し、足りない分を補う
  const out: string[] = [];
  for (let attempt = 0; attempt < 2 && out.length < SUGGESTION_COUNT; attempt++) {
    for (const s of parseSuggestions(await generateText(input.provider, req), input.viewpoint, input.previous)) {
      if (!out.includes(s) && out.length < SUGGESTION_COUNT) out.push(s);
    }
    if (input.signal?.aborted) return out;
  }
  // 見守りでは、ボタンが足りないと次の指示を考えにくいので、そのまま続きを見る選択肢を足す
  if (input.viewpoint === "watch" && out.length < SUGGESTION_COUNT) out.push(WATCH_FALLBACK);
  return out;
}
