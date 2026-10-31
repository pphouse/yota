/**
 * 一行のアイデアから、作品の下書きを文章AIに作らせる（サーバー専用）。
 * 形は、こちらで作った作品（眠り王子）を例として見せてそろえる。
 */
import { getPlot, type Plot, type Viewpoint } from "./characters";
import { generateText, type LLMProvider } from "./llm";
import { checkCreation, PlotInput, sanitize, type CreationProblem } from "./ugc-schema";

/** こちらの作品を、ユーザーの作品の入力の形にする（下書きの例に使う） */
export function toInput(plot: Plot): PlotInput {
  return {
    title: plot.title,
    catchphrase: plot.catchphrase,
    tags: plot.tags,
    genres: plot.genres,
    viewpoints: plot.viewpoints,
    personas: plot.personas.map((p) => ({
      name: p.name,
      reading: p.reading,
      age: p.age,
      height: p.height,
      profile: p.profile,
      personality: p.personality,
      speech: p.speech,
      likes: p.likes,
      dislikes: p.dislikes,
      habits: p.habits,
      inLove: p.inLove,
      topics: p.topics,
      mbti: p.mbti,
      stats: p.stats,
      color: p.color,
    })),
    intro: plot.intro ?? "",
    prologue: plot.prologue ?? "",
    role: plot.role,
    setting: plot.setting,
    opening: { self: plot.opening.self, watch: plot.opening.watch },
    starterReplies: { self: plot.starterReplies.self, watch: plot.starterReplies.watch },
    hooks: plot.hooks,
  };
}

function system(viewpoint: Viewpoint): string {
  const example = getPlot(viewpoint === "watch" ? "dorm-rivals" : "sleepy-prince")!;
  return [
    "あなたは、女性向けの対話型ストーリーアプリ「yota」の作品編集者です。ユーザーの一行のアイデアから、作品の設定を作ります。",
    "出力は JSON だけにしてください（説明の文やコードブロックの記号は書かない）。形と項目は、下の例とまったく同じにします。",
    "",
    "【必ず守ること】",
    "- 登場人物は全員、20歳以上の架空の人物にする。高校生以下・未成年・子どもは出さない。学校が舞台なら大学にする。",
    "- 「高校」「中学」「小学」「生徒」という言葉は、過去の思い出でも使わない（思い出は「学生時代」「昔」と書く）。",
    "- 実在の人物や、既存の漫画・アニメ・ゲームのキャラクター名・作品名は使わない。すべてオリジナルにする。",
    "- 性的な場面や露骨な表現は書かない。恋愛のときめき・甘さ・嫉妬は書いてよい。",
    viewpoint === "watch"
      ? "- 遊び方は watch（ふたりを見守る）。ユーザーは登場せず、ふたりの男性（BLのペア）のやり取りを眺める。viewpoints は [\"watch\", \"self\"]、登場人物は必ず2人。opening と starterReplies は watch と self の両方を書く。"
      : "- 遊び方は self（あなたが物語にいる）。ユーザー（あなた）がキャラと直接話す。viewpoints は [\"self\"]、登場人物は1人（多くても2人）。opening と starterReplies は self だけ書く。",
    "- タイトルは短く引っかかる一言（8〜14字。台詞か、状況が一目で分かる一言）。キャッチコピーは1行で状況とツッコミどころが分かる文（40字以内）。",
    "- opening（最初の一言）は、キャラから話しかける1〜3文。動作は *…* で囲む。2人の作品では、台詞を 呼び名「…」 の形で書き、2人とも話す。",
    "- opening の地の文には、キャラの動作だけを書く。ユーザー（あなた）の行動・台詞・気持ちは書かない（「あなたが手を伸ばすと」などは書かない）。",
    "- speech（口調）には、話し方・例の台詞・「一人称は〜、相手を「〜」と呼ぶ」を書く。",
    "- intro は2〜3段落（改行で区切る）。prologue は会話の最初に出す情景の短い文（watch がある作品では「あなた」を書かない）。role は self のときのユーザーの立場。",
    "- stats は sweet（甘さ）・devoted（一途）・possessive（独占欲）・warmth（包容力）・tsundere（ツンデレ）・mystery（ミステリアス）の6つを0〜100で。mbti は4文字。color は推し色（#rrggbb）。",
    "- genres は次から1〜3個：campus（学園）office（オフィス・お仕事）fantasy（ファンタジー）nonhuman（人外）sweet（溺愛・甘々）rivals（ライバル・犬猿）daily（日常・同居）reunion（幼なじみ・再会）marriage（結婚・婚約）",
    "",
    "【例】",
    JSON.stringify(toInput(example)),
  ].join("\n");
}

/** 文章から、最初の { から最後の } までを JSON として読む。最後の } が欠けていたら補って読む */
export function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0) throw new Error("JSON が見つかりません");
  try {
    if (end <= start) throw new Error("JSON が閉じていません");
    return JSON.parse(text.slice(start, end + 1));
  } catch (e) {
    try {
      return JSON.parse(text.slice(start).trimEnd() + "}");
    } catch {
      throw e;
    }
  }
}

export type DraftResult = { ok: true; input: PlotInput } | { ok: false; error: string; problems?: CreationProblem[] };

/** 下書きを作る。形が崩れていたり、安全判定に引っかかったりしたら、理由を添えて1回だけ作り直させる */
export async function draftPlot(provider: LLMProvider, idea: string, viewpoint: Viewpoint): Promise<DraftResult> {
  const messages: { role: "user" | "assistant"; content: string }[] = [{ role: "user", content: `アイデア：${idea}` }];
  let last: DraftResult = { ok: false, error: "下書きを作れませんでした" };
  for (let attempt = 0; attempt < 2; attempt++) {
    const out = await generateText(provider, { system: system(viewpoint), messages, tier: "quality", maxTokens: 4000 });
    let fix = "";
    try {
      const parsed = PlotInput.safeParse(extractJson(out));
      if (!parsed.success) {
        fix = `形が正しくありません：${parsed.error.issues
          .slice(0, 5)
          .map((i) => `${i.path.join(".")} ${i.message}`)
          .join("／")}`;
      } else {
        const input = sanitize(parsed.data);
        const problems = checkCreation(input);
        if (problems.length === 0) return { ok: true, input };
        fix = "未成年を思わせる言葉や、性的な言葉が入っています。登場人物は全員20歳以上・大学以上にし、性的な言葉を使わずに書き直してください。";
        last = { ok: false, error: "アイデアの内容では作れませんでした。表現を変えてもう一度お試しください。", problems };
      }
    } catch {
      fix = "JSON として読めませんでした。";
    }
    messages.push({ role: "assistant", content: out.slice(0, 6000) }, { role: "user", content: `${fix}\n同じアイデアで、例と同じ形の JSON だけを出力し直してください。` });
  }
  return last;
}
