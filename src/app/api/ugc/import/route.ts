import { z } from "zod";
import { getProvider } from "@/lib/llm";
import { checkText } from "@/lib/safety";
import { getSession } from "@/lib/session";
import { logEvent } from "@/lib/store";
import { countRecent } from "@/lib/ugc";
import { IMPORT_MAX, IMPORT_MIN, importPlot } from "@/lib/ugc-import";
import { PROBLEM_MESSAGE } from "@/lib/ugc-schema";

/** 1日に引っ越せる回数（AIの費用と、いたずらを抑える） */
const IMPORTS_PER_DAY = 10;

const Body = z.object({
  source: z.string().trim().min(IMPORT_MIN).max(IMPORT_MAX),
  viewpoint: z.enum(["self", "watch"]),
  // 自分が作ったオリジナルの作品であることの確認
  original: z.literal(true),
});

/** ほかのアプリで作った作品の設定を貼ってもらい、作品の下書きにする（まだ保存しない） */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "年齢の確認が必要です" }, { status: 401 });
  if (session.isMinor) return Response.json({ error: "作品を作れるのは18歳以上の方です" }, { status: 403 });
  const raw = await req.json().catch(() => null);
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    if (raw && raw.original !== true) return Response.json({ error: "自分が作ったオリジナルの作品かどうか、確認してください" }, { status: 400 });
    return Response.json({ error: `作品の設定を${IMPORT_MIN}〜${IMPORT_MAX}文字で貼ってください` }, { status: 400 });
  }
  // 子どもを性的に扱う内容は、AIに渡す前に止める。
  // 大人どうしの露骨な表現は止めない（AIが移さずに落とし、できた下書きを checkCreation で確かめる）
  const verdict = checkText(parsed.data.source);
  if (!verdict.ok && verdict.reason === "minor_sexual") return Response.json({ error: PROBLEM_MESSAGE.minor }, { status: 422 });
  if ((await countRecent(session.id, "ugc_import")) >= IMPORTS_PER_DAY) {
    return Response.json({ error: "今日の引っ越しの回数の上限に達しました。また明日お試しください" }, { status: 429 });
  }
  await logEvent(session.id, "ugc_import", { viewpoint: parsed.data.viewpoint, length: parsed.data.source.length });
  const result = await importPlot(getProvider(), parsed.data.source, parsed.data.viewpoint).catch(() => null);
  if (!result) return Response.json({ error: "下書きを作れませんでした。もう一度お試しください" }, { status: 502 });
  if (!result.ok) return Response.json({ error: result.error, problems: result.problems }, { status: 422 });
  return Response.json({ draft: result.input, notes: result.notes ?? [] });
}
