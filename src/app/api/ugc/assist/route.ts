import { z } from "zod";
import { getProvider } from "@/lib/llm";
import { getSession } from "@/lib/session";
import { logEvent } from "@/lib/store";
import { countRecent } from "@/lib/ugc";
import { assist, ASSIST_SPECS, type AssistField } from "@/lib/ugc-assist";

/** 1日に「AIで考える」を使える回数（AIの費用と、いたずらを抑える） */
const ASSISTS_PER_DAY = 200;

const Body = z.object({
  field: z.enum(Object.keys(ASSIST_SPECS) as [AssistField, ...AssistField[]]),
  index: z.number().int().min(0).max(1).default(0),
  // 書きかけの作品。形はそろっていなくてよい（AIに読ませるだけ）
  plot: z.record(z.string(), z.unknown()),
});

/** 作る画面の「AIで考える」：1つの項目の案をいくつか返す */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "年齢の確認が必要です" }, { status: 401 });
  if (session.isMinor) return Response.json({ error: "作品を作れるのは18歳以上の方です" }, { status: 403 });
  const text = await req.text();
  if (text.length > 20_000) return Response.json({ error: "内容が長すぎます" }, { status: 413 });
  const parsed = Body.safeParse((() => {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  })());
  if (!parsed.success) return Response.json({ error: "リクエストが正しくありません" }, { status: 400 });
  if ((await countRecent(session.id, "ugc_assist")) >= ASSISTS_PER_DAY) {
    return Response.json({ error: "今日の「AIで考える」の回数の上限に達しました。また明日お試しください" }, { status: 429 });
  }
  await logEvent(session.id, "ugc_assist", { field: parsed.data.field });
  const options = await assist(getProvider(), parsed.data.field, parsed.data.plot, parsed.data.index).catch((e) => {
    console.error("[ugc/assist]", e);
    return null;
  });
  if (!options) return Response.json({ error: "案を考えられませんでした。もう一度お試しください" }, { status: 502 });
  if (!options.length) return Response.json({ error: "いい案が出ませんでした。ほかの項目を少し書いてから、もう一度お試しください" }, { status: 422 });
  return Response.json({ options });
}
