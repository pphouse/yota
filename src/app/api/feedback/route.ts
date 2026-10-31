import { z } from "zod";
import { COMPARE, NOTE_CATEGORIES, type Compare, type NoteCategory } from "@/lib/feedback";
import { normalizeRef } from "@/lib/ref";
import { getSession } from "@/lib/session";
import { addFeedback, getConversation, listMessages, logEvent } from "@/lib/store";

const compareKeys = Object.keys(COMPARE) as [Compare, ...Compare[]];
const categoryKeys = Object.keys(NOTE_CATEGORIES) as [NoteCategory, ...NoteCategory[]];

const Body = z.discriminatedUnion("kind", [
  // 会話のあとのひとこと評価
  z.object({
    kind: z.literal("rating"),
    conversationId: z.string().min(1).max(64),
    score: z.number().int().min(1).max(5),
    compare: z.enum(compareKeys).optional(),
    text: z.string().max(500).optional(),
  }),
  // ホームから送るご意見（年齢確認の前でも送れる）
  z.object({
    kind: z.literal("note"),
    category: z.enum(categoryKeys),
    text: z.string().trim().min(1).max(1000),
    contact: z.string().trim().max(100).optional(),
    ref: z.string().max(64).optional(),
  }),
]);

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "内容を確かめて、もう一度送ってください" }, { status: 400 });
  const session = await getSession();
  const body = parsed.data;

  if (body.kind === "rating") {
    if (!session) return Response.json({ error: "年齢の確認が必要です" }, { status: 401 });
    const conv = await getConversation(body.conversationId, session.id);
    if (!conv) return Response.json({ error: "会話が見つかりません" }, { status: 404 });
    const turns = (await listMessages(conv.id)).filter((m) => m.role === "user").length;
    await addFeedback({
      sessionId: session.id,
      kind: "rating",
      plotId: conv.plotId,
      conversationId: conv.id,
      score: body.score,
      compare: body.compare ?? null,
      text: body.text?.trim() ?? "",
      turns,
      ref: session.ref,
    });
    await logEvent(session.id, "feedback", { kind: "rating", score: body.score, plotId: conv.plotId, compare: body.compare ?? null });
    return Response.json({ ok: true });
  }

  await addFeedback({
    sessionId: session?.id ?? null,
    kind: "note",
    category: body.category,
    text: body.text,
    contact: body.contact ?? "",
    ref: session?.ref || normalizeRef(body.ref),
  });
  await logEvent(session?.id ?? null, "feedback", { kind: "note", category: body.category });
  return Response.json({ ok: true });
}
