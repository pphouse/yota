import { after } from "next/server";
import { z } from "zod";
import { jacketEnabled } from "@/lib/jacket";
import { getSession } from "@/lib/session";
import { logEvent } from "@/lib/store";
import { countRecent, deleteUgc, drawJacket, getUgc, setUgcStatus, updateUgc } from "@/lib/ugc";
import { checkCreation, missingItems, PlotInput, PROBLEM_MESSAGE, sanitize } from "@/lib/ugc-schema";

// 題名を変えたらジャケットの絵を作り直す（1分ほどかかる）
export const maxDuration = 300;

/** 1日に保存し直せる回数 */
const EDITS_PER_DAY = 60;

/** 作者の作品を引く。作者でなければ、ないことにする */
async function ownEntry(id: string) {
  const session = await getSession();
  const entry = await getUgc(id);
  if (!session || !entry || entry.sessionId !== session.id || entry.meta.status === "removed") return null;
  return { session, entry };
}

const notFound = () => Response.json({ error: "作品が見つかりません" }, { status: 404 });

/** 作る画面で直すために、作者が書いたままの入力を返す（作者だけ） */
export async function GET(_req: Request, ctx: RouteContext<"/api/ugc/[id]">) {
  const own = await ownEntry((await ctx.params).id);
  if (!own) return notFound();
  return Response.json({ input: own.entry.input, meta: own.entry.meta });
}

/** 作品を直して保存する（作者だけ）。公開中なら、もう一度確認するまで一覧から外す */
export async function PUT(req: Request, ctx: RouteContext<"/api/ugc/[id]">) {
  const { id } = await ctx.params;
  const own = await ownEntry(id);
  if (!own) return notFound();
  const { session, entry } = own;
  const raw = (await req.json().catch(() => null))?.plot;
  const parsed = PlotInput.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ error: `まだ書いていない項目があります（${missingItems(raw).map((m) => m.label).join("・")}）` }, { status: 400 });
  }
  const input = sanitize(parsed.data);
  const problems = checkCreation(input);
  if (problems.length) return Response.json({ error: PROBLEM_MESSAGE[problems[0]], problems }, { status: 422 });
  if ((await countRecent(session.id, "ugc_edit")) >= EDITS_PER_DAY) {
    return Response.json({ error: "今日保存できる回数の上限に達しました。また明日お試しください" }, { status: 429 });
  }
  const status = entry.meta.status === "public" ? "pending" : entry.meta.status;
  const redraw = jacketEnabled() && (input.title !== entry.input.title || entry.meta.jacketStatus === "failed");
  await updateUgc(id, input, { status, jacketStatus: redraw ? "pending" : undefined });
  await logEvent(session.id, "ugc_edit", { id, redraw });
  if (redraw) after(() => drawJacket(id));
  return Response.json({ ok: true, status });
}

const Body = z.object({ action: z.enum(["submit", "withdraw", "delete"]) });

/** 作者だけができる操作：一覧への掲載を申請する・申請を取り下げる・削除する */
export async function PATCH(req: Request, ctx: RouteContext<"/api/ugc/[id]">) {
  const { id } = await ctx.params;
  const own = await ownEntry(id);
  if (!own) return notFound();
  const { session, entry } = own;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid" }, { status: 400 });
  const { action } = parsed.data;
  if (action === "delete") await deleteUgc(id);
  else if (action === "submit" && entry.meta.status === "private") await setUgcStatus(id, "pending");
  else if (action === "withdraw") await setUgcStatus(id, "private");
  await logEvent(session.id, "ugc_" + action, { id });
  return Response.json({ ok: true });
}
