/**
 * ユーザーの作品のジャケット（タイトルの文字入りの表紙）を、画像生成AIで作る（サーバー専用）。
 * OpenAI 互換の Images API を使う。IMAGE_API_KEY がなければ作らず、画面では文字だけのジャケットを出す。
 *   IMAGE_API_KEY   … 画像生成のキー（必須）
 *   IMAGE_BASE_URL  … 既定は https://api.openai.com/v1
 *   IMAGE_MODEL     … 既定は gpt-image-1
 *   IMAGE_QUALITY   … 既定は high
 */
import type { Plot } from "./characters";

type Env = Record<string, string | undefined>;

export function jacketEnabled(env: Env = process.env): boolean {
  return Boolean(env.IMAGE_API_KEY);
}

/** 画像生成への指示。日本語の文字が崩れやすいので、タイトルは1文字ずつ並べて書く */
export function jacketPrompt(plot: Plot): string {
  const genre = plot.viewpoints.includes("watch") ? "BL romance" : "josei romance";
  const people = plot.personas.map((p) => `${p.name}（${p.age}歳）: ${p.profile}`).join(" / ");
  const chars = Array.from(plot.title);
  const bubble = plot.personas[0]?.habits?.[0];
  return [
    `The front cover of a hit Japanese ${genre} light novel / webtoon, the kind that ranks #1 on a romance story app. Polished, beautiful, highly detailed anime illustration with dramatic lighting and an eye-catching composition.`,
    `Characters (all adults, original characters): ${people}.`,
    `Scene: ${plot.prologue ?? plot.setting}`,
    `Typography, rendered exactly with correct Japanese characters and nothing added: the title 「${plot.title}」 — exactly these ${chars.length} characters in order: ${chars.join(" / ")}. Large stylish hand-lettered Japanese type integrated into the art, kept at least 8% away from the top and bottom edges.`,
    bubble ? `One small speech bubble near the character containing 「${bubble}」.` : "",
    "No other text, no logos, no watermark. No nudity, no sexual content.",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function generateJacket(plot: Plot, env: Env = process.env): Promise<Uint8Array> {
  const base = env.IMAGE_BASE_URL || "https://api.openai.com/v1";
  const res = await fetch(`${base}/images/generations`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${env.IMAGE_API_KEY}` },
    body: JSON.stringify({
      model: env.IMAGE_MODEL || "gpt-image-1",
      prompt: jacketPrompt(plot),
      size: "1024x1536",
      quality: env.IMAGE_QUALITY || "high",
      output_format: "webp",
      output_compression: 82,
      n: 1,
    }),
    signal: AbortSignal.timeout(240_000),
  });
  if (!res.ok) throw new Error(`画像生成に失敗しました（${res.status}）：${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { data?: { b64_json?: string }[] };
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error("画像が返ってきませんでした");
  return Uint8Array.from(Buffer.from(b64, "base64"));
}
