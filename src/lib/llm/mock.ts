import type { GenerateRequest, LLMProvider } from "./types";

/**
 * APIキーがなくても開発・デモができるダミー応答。
 * システムプロンプトの「- 名前：」行から登場人物を拾い、それらしい返答を少しずつ流す。
 */
export class MockProvider implements LLMProvider {
  readonly name = "mock";

  constructor(private readonly delayMs = 12) {}

  async *stream(req: GenerateRequest): AsyncIterable<string> {
    const text = req.purpose === "summary" ? summarize(req) : reply(req);
    for (let i = 0; i < text.length; i += 3) {
      if (req.signal?.aborted) return;
      if (i > 0 && this.delayMs > 0) await sleep(this.delayMs);
      yield text.slice(i, i + 3);
    }
  }
}

function names(system: string): string[] {
  return [...system.matchAll(/^- 名前：(.+?)（/gm)].map((m) => m[1].trim());
}

function shortName(full: string): string {
  if (full.includes("・")) return full.split("・")[0];
  const parts = full.split(/\s/);
  return parts[parts.length - 1];
}

/** 書き直しで毎回ちがう返答になるよう、候補から選ぶ */
const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)];

/** 相手の言葉を台詞の中で繰り返せる形にする（行動・括弧を除き、区切りのよいところで切る） */
function echoOf(text: string): string {
  const plain = text
    .replace(/\*[^*]*\*/g, "")
    .replace(/[「」『』]/g, "")
    .trim();
  const first = plain.split(/[。！？!?\n]/)[0] ?? "";
  if (first.length <= 20) return first;
  const cut = first.slice(0, 20);
  const comma = cut.lastIndexOf("、");
  return comma >= 6 ? cut.slice(0, comma) : cut;
}

function reply(req: GenerateRequest): string {
  const cast = names(req.system).map(shortName);
  const last = [...req.messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const echo = echoOf(last);
  const watching = req.system.includes("【視点：見守り】");

  if (watching && cast.length >= 2) {
    const [a, b] = cast;
    return [
      pick([`*${a}がふと顔を上げ、${b}の横顔を見つめる*`, `*${a}の手が止まる。${b}は気づかないふりをした*`]),
      `${a}「${echo ? `……${echo}、か。` : "……なあ。"}${pick(["お前、昔からそういうとこあるよな", "なんで言わなかったんだよ"])}」`,
      `*${b}は目を逸らす*`,
      `${b}「${pick(["うるさい。……でも、嫌いじゃない", "……覚えてたんだな", "言ったら、お前は止めただろ"])}」`,
      pick(["*二人のあいだに、少しだけ長い沈黙が落ちた*", "*窓の外で、始発の音がした*"]),
    ].join("\n");
  }
  const who = cast[0] ?? "彼";
  // ふたり以上の作品では、誰の台詞か分かるよう名前を付ける
  const say = (t: string) => (cast.length > 1 ? `${who}「${t}」` : `「${t}」`);
  return [
    pick([`*${who}は少しだけ目を細めて、あなたの言葉を聞いていた*`, `*${who}はふと手を止め、あなたをまっすぐ見る*`]),
    say(echo ? `${echo}……そうか` : "……そうか"),
    pick(["*小さく息を吐いて、視線をそらす*", "*あなたとの距離を、一歩だけ詰める*", "*ほんの少しだけ、口元がゆるんだ*"]),
    say(pick(["……もう少し、ここにいろ", "次は、もう少しちゃんと話を聞かせて", "無理して笑わなくていい。俺の前では"])),
    "",
    "（ダミー応答です。APIキーを設定すると本物のAIが返答します）",
  ].join("\n");
}

function summarize(req: GenerateRequest): string {
  const body = req.messages.map((m) => m.content).join(" ").replace(/\s+/g, " ");
  return `これまでのあらすじ（ダミー要約）：${body.slice(0, 200)}`;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
