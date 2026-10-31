import type { ChatEvent } from "./chat";

type TrackType = "card_open" | "card_share" | "card_download" | "viewpoint_select" | "genre_select" | "landing_view" | "suggestion_select";

export function track(type: TrackType, props: Record<string, string | number | boolean | null> = {}) {
  void fetch("/api/events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ type, props }),
    keepalive: true,
  }).catch(() => {});
}

export type SessionInfo = { session: { isMinor: boolean; name: string } | null; played?: string[] };

let sessionInfo: { at: number; promise: Promise<SessionInfo | null> } | null = null;

/**
 * ホームの部品（名前・あなたにおすすめ）で、/api/session を分け合って1回だけ取りに行く。
 * 数秒たったら取り直す（物語を遊んで戻ってきたとき、おすすめを新しくするため）
 */
export function getSessionInfo(): Promise<SessionInfo | null> {
  if (!sessionInfo || Date.now() - sessionInfo.at > 5000) {
    sessionInfo = { at: Date.now(), promise: api<SessionInfo>("/api/session").then((r) => (r.ok ? r.data : null)) };
  }
  return sessionInfo.promise;
}

/** NDJSON の返答を1イベントずつ読む */
export async function* readEvents(res: Response): AsyncGenerator<ChatEvent> {
  if (!res.body) return;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (line) yield JSON.parse(line) as ChatEvent;
    }
  }
  if (buf.trim()) yield JSON.parse(buf) as ChatEvent;
}

export async function api<T>(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data: T }> {
  const res = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  const data = (await res.json().catch(() => ({}))) as T;
  return { ok: res.ok, status: res.status, data };
}
