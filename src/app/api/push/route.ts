import { z } from "zod";
import { savePushToken } from "@/lib/account";
import { getSession } from "@/lib/session";

const Body = z.object({ token: z.string().min(16).max(4096), platform: z.enum(["ios", "android"]) });

/** アプリから、通知を送る先の端末を登録する */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "年齢の確認が必要です" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "登録できませんでした" }, { status: 400 });
  await savePushToken(session.id, parsed.data.token, parsed.data.platform);
  return Response.json({ ok: true });
}
