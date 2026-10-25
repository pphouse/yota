import type { ChatEvent } from "./chat";

type TrackType = "card_open" | "card_share" | "card_download" | "viewpoint_select" | "landing_view";

export function track(type: TrackType, props: Record<string, string | number | boolean | null> = {}) {
  void fetch("/api/events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ type, props }),
    keepalive: true,
  }).catch(() => {});
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
