import { z } from "zod";
import { generateText, getProvider } from "@/lib/llm";
import { hasForeignText, stripForeignScripts } from "@/lib/japanese";
import { buildSystemPrompt, toApiMessages } from "@/lib/prompt";
import { BLOCKED_INPUT_MESSAGE, BLOCKED_OUTPUT_TEXT, checkText } from "@/lib/safety";
import { getSession } from "@/lib/session";
import { logEvent } from "@/lib/store";
import { countRecent } from "@/lib/ugc";
import { checkCreation, forTrial, PROBLEM_MESSAGE, sanitize, toPlot } from "@/lib/ugc-schema";
import { fillUser, nameInNarration } from "@/lib/username";

/** 1日に「試しに話す」で送れる回数 */
const TRIES_PER_DAY = 150;

const Body = z.object({
  plot: z.record(z.string(), z.unknown()),
  viewpoint: z.enum(["self", "watch"]),
  // 最初の一言のあとのやり取り（最後はユーザーの言葉）
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(1500) })).min(1).max(24),
});

/** 作る画面の「試しに話す」：書きかけの作品で、保存せずに会話を試す */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "年齢の確認が必要です" }, { status: 401 });
  if (session.isMinor) return Response.json({ error: "作品を作れるのは18歳以上の方です" }, { status: 403 });
  const text = await req.text();
  if (text.length > 60_000) return Response.json({ error: "内容が長すぎます" }, { status: 413 });
  const parsed = Body.safeParse((() => {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  })());
  if (!parsed.success) return Response.json({ error: "リクエストが正しくありません" }, { status: 400 });
  const { viewpoint, messages } = parsed.data;
  const trial = forTrial(parsed.data.plot, viewpoint);
  if (!trial.ok) return Response.json({ error: `話すには、${trial.missing.map((m) => m.label).join("・")}が必要です`, missing: trial.missing }, { status: 400 });
  const input = sanitize(trial.input);
  const problems = checkCreation(input);
  if (problems.length) return Response.json({ error: PROBLEM_MESSAGE[problems[0]], problems }, { status: 422 });
  const last = messages.at(-1)!;
  if (last.role !== "user") return Response.json({ error: "リクエストが正しくありません" }, { status: 400 });
  if (!checkText(last.content).ok) return Response.json({ blocked: true, error: BLOCKED_INPUT_MESSAGE }, { status: 422 });
  if ((await countRecent(session.id, "ugc_try")) >= TRIES_PER_DAY) {
    return Response.json({ error: "今日の「試しに話す」の回数の上限に達しました。保存してから遊ぶと続けられます" }, { status: 429 });
  }
  await logEvent(session.id, "ugc_try", { viewpoint });

  const plot = toPlot("u-trial", input);
  const userName = viewpoint === "self" ? session.name : "";
  const opening = fillUser(plot.opening[viewpoint] ?? "", userName);
  const history = [{ role: "assistant" as const, content: viewpoint === "self" ? nameInNarration(opening, userName) : opening }, ...messages];
  const system = buildSystemPrompt({
    plot,
    viewpoint,
    isMinor: false,
    summary: "",
    userTurns: messages.filter((m) => m.role === "user").length,
    userName,
  });
  const provider = getProvider();
  let reply = "";
  for (let attempt = 0; attempt < 2 && !reply; attempt++) {
    reply = (await generateText(provider, { system, messages: toApiMessages(history), tier: "fast", purpose: "chat" }).catch(() => "")).trim();
    if (hasForeignText(reply)) reply = stripForeignScripts(reply).trim();
  }
  if (!reply) return Response.json({ error: "返事を作れませんでした。もう一度お試しください" }, { status: 502 });
  if (!checkText(reply).ok) reply = BLOCKED_OUTPUT_TEXT;
  return Response.json({ reply, opening: history[0].content });
}
