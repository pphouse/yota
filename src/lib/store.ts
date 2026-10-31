import type { Viewpoint } from "./characters";
import { query, run } from "./db";
import type { ChatRole } from "./llm/types";

export type Conversation = {
  id: string;
  sessionId: string;
  plotId: string;
  viewpoint: Viewpoint;
  summary: string;
  summarizedCount: number;
};

export type StoredMessage = {
  id: string;
  seq: number;
  role: ChatRole;
  content: string;
  flagged: boolean;
};

type ConvRow = {
  id: string;
  session_id: string;
  plot_id: string;
  viewpoint: string;
  summary: string;
  summarized_count: number;
};
type MsgRow = { id: string; seq: number; role: string; content: string; flagged: number };

const toConv = (r: ConvRow): Conversation => ({
  id: r.id,
  sessionId: r.session_id,
  plotId: r.plot_id,
  viewpoint: r.viewpoint as Viewpoint,
  summary: r.summary,
  summarizedCount: Number(r.summarized_count),
});

const toMsg = (r: MsgRow): StoredMessage => ({
  id: r.id,
  seq: Number(r.seq),
  role: r.role as ChatRole,
  content: r.content,
  flagged: Number(r.flagged) === 1,
});

export async function createConversation(sessionId: string, plotId: string, viewpoint: Viewpoint): Promise<Conversation> {
  const id = crypto.randomUUID();
  const now = Date.now();
  await run(
    "INSERT INTO conversations (id, session_id, plot_id, viewpoint, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    [id, sessionId, plotId, viewpoint, now, now],
  );
  return { id, sessionId, plotId, viewpoint, summary: "", summarizedCount: 0 };
}

export async function getConversation(id: string, sessionId: string): Promise<Conversation | null> {
  const rows = await query<ConvRow>("SELECT * FROM conversations WHERE id = ? AND session_id = ?", [id, sessionId]);
  return rows[0] ? toConv(rows[0]) : null;
}

export async function getLatestConversation(sessionId: string, plotId: string, viewpoint: Viewpoint): Promise<Conversation | null> {
  const rows = await query<ConvRow>(
    "SELECT * FROM conversations WHERE session_id = ? AND plot_id = ? AND viewpoint = ? ORDER BY updated_at DESC LIMIT 1",
    [sessionId, plotId, viewpoint],
  );
  return rows[0] ? toConv(rows[0]) : null;
}

/** そのセッションで開いた作品（最近のものから）。「あなたにおすすめ」に使う */
export async function listPlayedPlots(sessionId: string, limit = 20): Promise<string[]> {
  const rows = await query<{ plot_id: string }>(
    "SELECT plot_id, MAX(updated_at) AS last FROM conversations WHERE session_id = ? GROUP BY plot_id ORDER BY last DESC LIMIT ?",
    [sessionId, limit],
  );
  return rows.map((r) => String(r.plot_id));
}

export async function listMessages(conversationId: string, fromSeq = 0): Promise<StoredMessage[]> {
  const rows = await query<MsgRow>(
    "SELECT id, seq, role, content, flagged FROM messages WHERE conversation_id = ? AND seq >= ? ORDER BY seq",
    [conversationId, fromSeq],
  );
  return rows.map(toMsg);
}

export async function countMessages(conversationId: string): Promise<number> {
  const rows = await query<{ n: number }>("SELECT COUNT(*) AS n FROM messages WHERE conversation_id = ?", [conversationId]);
  return Number(rows[0]?.n ?? 0);
}

export async function addMessage(
  conversationId: string,
  role: ChatRole,
  content: string,
  flagged = false,
): Promise<StoredMessage> {
  const id = crypto.randomUUID();
  const rows = await query<{ next: number }>(
    "SELECT COALESCE(MAX(seq), -1) + 1 AS next FROM messages WHERE conversation_id = ?",
    [conversationId],
  );
  const seq = Number(rows[0]?.next ?? 0);
  const now = Date.now();
  await run(
    "INSERT INTO messages (id, conversation_id, seq, role, content, flagged, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [id, conversationId, seq, role, content, flagged ? 1 : 0, now],
  );
  await run("UPDATE conversations SET updated_at = ? WHERE id = ?", [now, conversationId]);
  return { id, seq, role, content, flagged };
}

/** 再生成のため、最後のメッセージがキャラの返答ならそれを消す。消したら true。 */
export async function deleteLastAssistant(conversationId: string): Promise<boolean> {
  const rows = await query<MsgRow>(
    "SELECT id, seq, role, content, flagged FROM messages WHERE conversation_id = ? ORDER BY seq DESC LIMIT 1",
    [conversationId],
  );
  const last = rows[0];
  if (!last || last.role !== "assistant" || Number(last.seq) === 0) return false;
  await run("DELETE FROM messages WHERE id = ?", [last.id]);
  return true;
}

/** キャラの返答を手直しする。自分の会話のメッセージだけ編集できる。 */
export async function updateAssistantMessage(messageId: string, sessionId: string, content: string): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `SELECT m.id FROM messages m JOIN conversations c ON c.id = m.conversation_id
     WHERE m.id = ? AND c.session_id = ? AND m.role = 'assistant'`,
    [messageId, sessionId],
  );
  if (!rows[0]) return false;
  await run("UPDATE messages SET content = ?, flagged = 0 WHERE id = ?", [content, messageId]);
  return true;
}

export async function setSummary(conversationId: string, summary: string, summarizedCount: number): Promise<void> {
  await run("UPDATE conversations SET summary = ?, summarized_count = ? WHERE id = ?", [summary, summarizedCount, conversationId]);
}

export async function logEvent(sessionId: string | null, type: string, props: Record<string, unknown> = {}): Promise<void> {
  await run("INSERT INTO events (session_id, type, props, created_at) VALUES (?, ?, ?, ?)", [
    sessionId,
    type,
    JSON.stringify(props),
    Date.now(),
  ]);
}
