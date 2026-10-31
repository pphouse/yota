/**
 * 「Xから生まれる彼」の結果の保存と読み出し（サーバー専用）。
 * 状態：working（投稿を読んで作っている）→ ready（できた）／ failed（作れなかった）
 */
import { query, run } from "./db";

export type XStatus = "working" | "ready" | "failed";

export type XResultData = {
  /** 表示名（X の名前） */
  name?: string;
  type?: string;
  roasts?: string[];
  sweet?: string;
  /** できた彼の作品（ユーザーの作品として保存したもの） */
  plotId?: string;
};

export type XResult = {
  id: string;
  sessionId: string;
  handle: string;
  status: XStatus;
  data: XResultData;
  error: string | null;
  createdAt: number;
};

type Row = { id: string; session_id: string; x_user: string; handle: string; status: XStatus; data: string; error: string | null; created_at: number };

const toResult = (r: Row): XResult => ({
  id: r.id,
  sessionId: r.session_id,
  handle: r.handle,
  status: r.status,
  data: JSON.parse(r.data || "{}") as XResultData,
  error: r.error,
  createdAt: Number(r.created_at),
});

/** X のユーザーIDは、そのままでは残さずハッシュにする */
export async function hashXUser(id: string): Promise<string> {
  const salt = process.env.X_HASH_SALT ?? "yota-x";
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}:${id}`)));
  return Buffer.from(d).toString("hex").slice(0, 32);
}

export async function createXResult(sessionId: string, xUser: string, handle: string, data: XResultData): Promise<string> {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  const id = Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => chars[b % chars.length]).join("");
  const now = Date.now();
  await run("INSERT INTO x_results (id, session_id, x_user, handle, status, data, created_at, updated_at) VALUES (?, ?, ?, ?, 'working', ?, ?, ?)", [
    id,
    sessionId,
    xUser,
    handle,
    JSON.stringify(data),
    now,
    now,
  ]);
  return id;
}

export async function finishXResult(id: string, status: Exclude<XStatus, "working">, data: XResultData, error?: string): Promise<void> {
  await run("UPDATE x_results SET status = ?, data = ?, error = ?, updated_at = ? WHERE id = ?", [status, JSON.stringify(data), error ?? null, Date.now(), id]);
}

export async function getXResult(id: string): Promise<XResult | null> {
  if (!/^[a-z0-9]{6,16}$/.test(id)) return null;
  const rows = await query<Row>("SELECT * FROM x_results WHERE id = ?", [id]);
  return rows[0] ? toResult(rows[0]) : null;
}

/** 同じ X アカウントの、最近のできた結果（あれば投稿を読み直さない） */
export async function recentXResult(xUser: string, withinMs: number): Promise<XResult | null> {
  const rows = await query<Row>("SELECT * FROM x_results WHERE x_user = ? AND status = 'ready' AND created_at >= ? ORDER BY created_at DESC LIMIT 1", [
    xUser,
    Date.now() - withinMs,
  ]);
  return rows[0] ? toResult(rows[0]) : null;
}

/** 今日（日本時間）に投稿を読んだ回数。X API の費用の上限に使う */
export async function countXToday(now = Date.now()): Promise<number> {
  const jst = 9 * 3600 * 1000;
  const start = Math.floor((now + jst) / 86_400_000) * 86_400_000 - jst;
  const rows = await query<{ n: number }>("SELECT COUNT(*) AS n FROM x_results WHERE created_at >= ?", [start]);
  return Number(rows[0]?.n ?? 0);
}
