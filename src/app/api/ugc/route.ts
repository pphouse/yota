import { after } from "next/server";
import { jacketEnabled } from "@/lib/jacket";
import { getSession } from "@/lib/session";
import { logEvent } from "@/lib/store";
import { countRecent, createUgc, drawJacket, listUgc } from "@/lib/ugc";
import { checkCreation, missingItems, PlotInput, PROBLEM_MESSAGE, sanitize } from "@/lib/ugc-schema";
import { fillPlot } from "@/lib/username";

// ジャケットの絵を作るのに1分ほどかかるので、返事を返したあとも続けて動けるようにする
export const maxDuration = 300;

/** 1日に保存できる作品の数 */
const CREATES_PER_DAY = 5;

/** みんなの作品（承認済み）か、自分の作品の一覧 */
export async function GET(req: Request) {
  const scope = new URL(req.url).searchParams.get("scope");
  if (scope === "mine") {
    const session = await getSession();
    if (!session) return Response.json({ items: [] });
    const items = await listUgc({ sessionId: session.id });
    return Response.json({ items: items.map(({ plot, meta }) => ({ plot: fillPlot(plot, ""), meta })) });
  }
  // 一覧に出す文章の {{user}} は「あなた」にする
  const items = await listUgc({ status: "public" });
  return Response.json({ items: items.map(({ plot, meta }) => ({ plot: fillPlot(plot, ""), meta })) });
}

/** 作品を保存する。リンクを知っている人が遊べる状態（private）で作り、ジャケットの絵はあとから作る */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "年齢の確認が必要です" }, { status: 401 });
  if (session.isMinor) return Response.json({ error: "作品を作れるのは18歳以上の方です" }, { status: 403 });
  const raw = (await req.json().catch(() => null))?.plot;
  const parsed = PlotInput.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ error: `まだ書いていない項目があります（${missingItems(raw).map((m) => m.label).join("・")}）` }, { status: 400 });
  }
  const input = sanitize(parsed.data);
  const problems = checkCreation(input);
  if (problems.length) return Response.json({ error: PROBLEM_MESSAGE[problems[0]], problems }, { status: 422 });
  if ((await countRecent(session.id, "ugc_create")) >= CREATES_PER_DAY) {
    return Response.json({ error: "今日作れる作品の数の上限に達しました。また明日お試しください" }, { status: 429 });
  }
  const withJacket = jacketEnabled();
  const id = await createUgc(session.id, session.name || "名無し", input, withJacket ? "pending" : "none");
  await logEvent(session.id, "ugc_create", { id, viewpoints: input.viewpoints.join(",") });
  if (withJacket) after(() => drawJacket(id));
  return Response.json({ id });
}
