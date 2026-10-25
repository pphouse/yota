import { z } from "zod";
import { getSession } from "@/lib/session";
import { logEvent } from "@/lib/store";

// 画面側から送ってよい計測イベントだけを受け付ける
const Body = z.object({
  type: z.enum(["card_open", "card_share", "card_download", "viewpoint_select", "landing_view", "suggestion_select"]),
  props: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid" }, { status: 400 });
  const session = await getSession();
  await logEvent(session?.id ?? null, parsed.data.type, parsed.data.props ?? {});
  return Response.json({ ok: true });
}
