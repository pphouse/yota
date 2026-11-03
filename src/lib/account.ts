import { query, run } from "./db";

/**
 * アカウント（匿名のセッション）と、それにつながるデータをすべて消す。
 * アプリストアの審査で求められる「アプリの中から退会できる」ためのもの。
 * 消すもの：会話・メッセージ・利用時間・記録・ご意見・作った作品と画像・Xの診断結果・通知の登録・ブロック・ログインの結びつき。
 * 文章AIの原価の記録（llm_usage）は、本人との紐づけを外す。
 */
export async function deleteAccount(sessionId: string): Promise<void> {
  await run("DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE session_id = ?)", [sessionId]);
  for (const table of ["conversations", "usage", "events", "feedback", "user_plots", "ugc_images", "x_results", "push_tokens", "identities"]) {
    await run(`DELETE FROM ${table} WHERE session_id = ?`, [sessionId]);
  }
  await run("DELETE FROM blocks WHERE session_id = ? OR author_session_id = ?", [sessionId, sessionId]);
  // 文章AIの原価の記録は、会話の中身を持たない数字だけなので、誰のものかの紐づけだけを外して残す（原価の合計が変わらないように）
  await run("UPDATE llm_usage SET session_id = NULL WHERE session_id = ?", [sessionId]);
  await run("DELETE FROM sessions WHERE id = ?", [sessionId]);
}

export type Block = { id: string; author: string; createdAt: number };

/** 作者をブロックする（同じ作者を二度ブロックしても1件のまま） */
export async function addBlock(sessionId: string, authorSessionId: string, author: string): Promise<void> {
  await run("INSERT OR IGNORE INTO blocks (id, session_id, author_session_id, author, created_at) VALUES (?, ?, ?, ?, ?)", [
    crypto.randomUUID(),
    sessionId,
    authorSessionId,
    author,
    Date.now(),
  ]);
}

export async function removeBlock(sessionId: string, id: string): Promise<void> {
  await run("DELETE FROM blocks WHERE session_id = ? AND id = ?", [sessionId, id]);
}

export async function listBlocks(sessionId: string): Promise<Block[]> {
  const rows = await query<{ id: string; author: string; created_at: number }>(
    "SELECT id, author, created_at FROM blocks WHERE session_id = ? ORDER BY created_at DESC",
    [sessionId],
  );
  return rows.map((r) => ({ id: r.id, author: r.author, createdAt: Number(r.created_at) }));
}

/** ブロックしている作者のセッションID（作品の一覧から外すため。画面には出さない） */
export async function blockedAuthors(sessionId: string): Promise<Set<string>> {
  const rows = await query<{ author_session_id: string }>("SELECT author_session_id FROM blocks WHERE session_id = ?", [sessionId]);
  return new Set(rows.map((r) => r.author_session_id));
}

/** 通知を送る先の端末を登録する。同じ端末が別のセッションで登録し直したら、新しいほうに付け替える */
export async function savePushToken(sessionId: string, token: string, platform: string): Promise<void> {
  const now = Date.now();
  await run(
    `INSERT INTO push_tokens (token, session_id, platform, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(token) DO UPDATE SET session_id = excluded.session_id, platform = excluded.platform, updated_at = excluded.updated_at`,
    [token, sessionId, platform, now, now],
  );
}
