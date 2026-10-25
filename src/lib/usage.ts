import { jstDayKey, jstHour } from "./age";
import { query, run } from "./db";

/** 未成年の1日あたりの利用上限（秒）。既定は3時間。 */
export const MINOR_DAILY_LIMIT_SEC = Number(process.env.MINOR_DAILY_LIMIT_SEC ?? 3 * 60 * 60);
/** 送信間隔がこれより長いときは、席を外していたとみなしてこの秒数だけ加算する。 */
const MAX_GAP_SEC = 120;
const FIRST_MESSAGE_SEC = 60;

export type UsageStatus = {
  activeSeconds: number;
  limitSeconds: number | null;
  overLimit: boolean;
  lateNight: boolean;
};

type Row = { active_seconds: number; last_at: number };

export async function getUsage(sessionId: string, isMinor: boolean, now = new Date()): Promise<UsageStatus> {
  const rows = await query<Row>("SELECT active_seconds, last_at FROM usage WHERE session_id = ? AND day = ?", [
    sessionId,
    jstDayKey(now),
  ]);
  return status(Number(rows[0]?.active_seconds ?? 0), isMinor, now);
}

/** 送信のたびに呼び、利用時間を加算した結果を返す。 */
export async function recordActivity(sessionId: string, isMinor: boolean, now = new Date()): Promise<UsageStatus> {
  const day = jstDayKey(now);
  const nowSec = Math.floor(now.getTime() / 1000);
  const rows = await query<Row>("SELECT active_seconds, last_at FROM usage WHERE session_id = ? AND day = ?", [sessionId, day]);
  let active: number;
  if (rows[0]) {
    const gap = Math.max(0, nowSec - Number(rows[0].last_at));
    active = Number(rows[0].active_seconds) + Math.min(gap, MAX_GAP_SEC);
    await run("UPDATE usage SET active_seconds = ?, last_at = ? WHERE session_id = ? AND day = ?", [active, nowSec, sessionId, day]);
  } else {
    active = FIRST_MESSAGE_SEC;
    await run("INSERT INTO usage (session_id, day, active_seconds, last_at) VALUES (?, ?, ?, ?)", [sessionId, day, active, nowSec]);
  }
  return status(active, isMinor, now);
}

function status(active: number, isMinor: boolean, now: Date): UsageStatus {
  const hour = jstHour(now);
  return {
    activeSeconds: active,
    limitSeconds: isMinor ? MINOR_DAILY_LIMIT_SEC : null,
    overLimit: isMinor && active >= MINOR_DAILY_LIMIT_SEC,
    lateNight: isMinor && (hour >= 23 || hour < 5),
  };
}
