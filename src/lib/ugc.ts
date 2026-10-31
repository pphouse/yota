/**
 * ユーザーが作った作品（UGC）の保存と読み出し（サーバー専用）。
 * 公開の段階：private（リンクを知っている人が遊べる）→ pending（一覧への掲載を申請中）→ public（承認されて一覧に載る）。
 * 運営が removed にすると、リンクでも開けなくなる。
 */
import { getPlot, type Plot } from "./characters";
import { query, run } from "./db";
import { isUgcId, PlotInput, toPlot, UGC_PREFIX } from "./ugc-schema";

export type UgcStatus = "private" | "pending" | "public" | "removed";
export type JacketStatus = "none" | "pending" | "ready" | "failed";

export type UgcMeta = {
  id: string;
  author: string;
  status: UgcStatus;
  jacketStatus: JacketStatus;
  createdAt: number;
  updatedAt: number;
};

type Row = {
  id: string;
  session_id: string;
  author: string;
  status: UgcStatus;
  data: string;
  jacket_status: JacketStatus;
  created_at: number;
  updated_at: number;
};

const COLUMNS = "id, session_id, author, status, data, jacket_status, created_at, updated_at";

function newId(): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  return UGC_PREFIX + Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => chars[b % chars.length]).join("");
}

function toEntry(row: Row): { plot: Plot; meta: UgcMeta; sessionId: string } | null {
  const parsed = PlotInput.safeParse(JSON.parse(row.data));
  if (!parsed.success) return null;
  const updatedAt = Number(row.updated_at);
  const jacket = row.jacket_status === "ready" ? `/api/ugc/${row.id}/jacket?v=${updatedAt}` : undefined;
  return {
    plot: toPlot(row.id, parsed.data, { jacket }),
    meta: { id: row.id, author: row.author, status: row.status, jacketStatus: row.jacket_status, createdAt: Number(row.created_at), updatedAt },
    sessionId: row.session_id,
  };
}

export async function createUgc(sessionId: string, author: string, input: PlotInput, jacketStatus: JacketStatus): Promise<string> {
  const id = newId();
  const now = Date.now();
  await run(
    `INSERT INTO user_plots (id, session_id, author, status, data, jacket_status, created_at, updated_at) VALUES (?, ?, ?, 'private', ?, ?, ?, ?)`,
    [id, sessionId, author, JSON.stringify(input), jacketStatus, now, now],
  );
  return id;
}

export async function getUgc(id: string) {
  if (!isUgcId(id)) return null;
  const rows = await query<Row>(`SELECT ${COLUMNS} FROM user_plots WHERE id = ?`, [id]);
  return rows[0] ? toEntry(rows[0]) : null;
}

/** こちらの作品でもユーザーの作品でも、IDから作品を引く。運営が外した作品は返さない */
export async function resolvePlot(id: string): Promise<Plot | undefined> {
  if (!isUgcId(id)) return getPlot(id);
  const entry = await getUgc(id);
  return entry && entry.meta.status !== "removed" ? entry.plot : undefined;
}

export async function listUgc(where: { status?: UgcStatus; sessionId?: string }, limit = 30) {
  const conds: string[] = ["status <> 'removed'"];
  const args: (string | number)[] = [];
  if (where.status) {
    conds.push("status = ?");
    args.push(where.status);
  }
  if (where.sessionId) {
    conds.push("session_id = ?");
    args.push(where.sessionId);
  }
  const rows = await query<Row>(`SELECT ${COLUMNS} FROM user_plots WHERE ${conds.join(" AND ")} ORDER BY updated_at DESC LIMIT ?`, [...args, limit]);
  return rows.map(toEntry).filter((e): e is NonNullable<typeof e> => e !== null);
}

export async function setUgcStatus(id: string, status: UgcStatus): Promise<void> {
  await run("UPDATE user_plots SET status = ?, updated_at = ? WHERE id = ?", [status, Date.now(), id]);
}

export async function setJacket(id: string, image: Uint8Array | null, status: JacketStatus): Promise<void> {
  await run("UPDATE user_plots SET jacket = ?, jacket_status = ?, updated_at = ? WHERE id = ?", [image, status, Date.now(), id]);
}

export async function getJacket(id: string): Promise<Uint8Array | null> {
  const rows = await query<{ jacket: ArrayBuffer | Uint8Array | null }>("SELECT jacket FROM user_plots WHERE id = ? AND status <> 'removed'", [id]);
  const j = rows[0]?.jacket;
  return j ? new Uint8Array(j instanceof ArrayBuffer ? j : j) : null;
}

export async function deleteUgc(id: string): Promise<void> {
  await run("DELETE FROM user_plots WHERE id = ?", [id]);
}

/** 直近24時間に、そのセッションが記録したイベントの数（作りすぎを防ぐ） */
export async function countRecent(sessionId: string, type: string): Promise<number> {
  const rows = await query<{ n: number }>("SELECT COUNT(*) AS n FROM events WHERE session_id = ? AND type = ? AND created_at >= ?", [
    sessionId,
    type,
    Date.now() - 24 * 60 * 60 * 1000,
  ]);
  return Number(rows[0]?.n ?? 0);
}
