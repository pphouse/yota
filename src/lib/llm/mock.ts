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
  const parts = full.split(/[\s・]/);
  return parts.length > 1 ? parts[parts.length - 1] : full;
}

function reply(req: GenerateRequest): string {
  const cast = names(req.system).map(shortName);
  const last = [...req.messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const echo = last.replace(/\*[^*]*\*/g, "").trim().slice(0, 24);
  const turn = req.messages.filter((m) => m.role === "user").length;
  const watching = req.system.includes("【視点：見守り】");

  if (watching && cast.length >= 2) {
    const [a, b] = cast;
    return [
      `*${a}がふと顔を上げ、${b}の横顔を見つめる*`,
      `${a}「${echo ? `……${echo}、か。` : "……なあ。"}お前、昔からそういうとこあるよな」`,
      `${b}「*目を逸らして* うるさい。……でも、${turn % 2 ? "嫌いじゃない" : "覚えてたんだな"}」`,
      `*二人のあいだに、少しだけ長い沈黙が落ちた*`,
    ].join("\n");
  }
  const who = cast[0] ?? "彼";
  return [
    `*${who}は少しだけ目を細めて、あなたの言葉を聞いていた*`,
    echo ? `「${echo}……そうか」` : "「……そうか」",
    `*小さく息を吐いて、${turn % 2 ? "視線をそらす" : "あなたとの距離を一歩詰める"}*`,
    `「${turn % 3 === 0 ? "……雨、止まないな。もう少しここにいろ" : "次は、もう少しちゃんと話を聞かせて"}」`,
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
