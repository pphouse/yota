import { z } from "zod";
import { getProvider } from "@/lib/llm";
import { checkText } from "@/lib/safety";
import { getSession } from "@/lib/session";
import { logEvent } from "@/lib/store";
import { countRecent } from "@/lib/ugc";
import { draftPlot } from "@/lib/ugc-draft";
import { PROBLEM_MESSAGE } from "@/lib/ugc-schema";

/** 1日に作れる下書きの数（AIの費用と、いたずらを抑える） */
const DRAFTS_PER_DAY = 20;

const Body = z.object({ idea: z.string().trim().min(4).max(200), viewpoint: z.enum(["self", "watch"]) });

/** 一行のアイデアから、作品の下書きを作る（まだ保存しない） */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "年齢の確認が必要です" }, { status: 401 });
  if (session.isMinor) return Response.json({ error: "作品を作れるのは18歳以上の方です" }, { status: 403 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "アイデアを4〜200文字で書いてください" }, { status: 400 });
  if (!checkText(parsed.data.idea).ok) return Response.json({ error: PROBLEM_MESSAGE.minor }, { status: 422 });
  if ((await countRecent(session.id, "ugc_draft")) >= DRAFTS_PER_DAY) {
    return Response.json({ error: "今日の下書きの回数の上限に達しました。また明日お試しください" }, { status: 429 });
  }
  await logEvent(session.id, "ugc_draft", { viewpoint: parsed.data.viewpoint });
  const result = await draftPlot(getProvider(), parsed.data.idea, parsed.data.viewpoint).catch(() => null);
  if (!result) return Response.json({ error: "下書きを作れませんでした。もう一度お試しください" }, { status: 502 });
  if (!result.ok) return Response.json({ error: result.error, problems: result.problems }, { status: 422 });
  return Response.json({ draft: result.input });
}
