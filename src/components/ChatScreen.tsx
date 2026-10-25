"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AgeGate } from "@/components/AgeGate";
import { SceneCard } from "@/components/SceneCard";
import { StoryText } from "@/components/StoryText";
import { getPlot, VIEWPOINT_LABEL, type Viewpoint } from "@/lib/characters";
import { api, readEvents } from "@/lib/client";
import { parseStory } from "@/lib/story";

type UIMessage = {
  key: string;
  id?: string;
  role: "user" | "assistant";
  content: string;
  flagged?: boolean;
  streaming?: boolean;
};

type Notice = { kind: "care" | "late_night" | "blocked" | "error" | "limit"; message: string; link?: string };

type Stored = { id: string; role: "user" | "assistant"; content: string; flagged: boolean };

let keySeq = 0;
const nextKey = () => `k${++keySeq}`;
const fromStored = (m: Stored): UIMessage => ({ key: m.id, id: m.id, role: m.role, content: m.content, flagged: m.flagged });

type Loaded = { kind: "gate" } | { kind: "error" } | { kind: "ok"; id: string; messages: Stored[] };

/** その作品・視点の会話を読み込む。まだなければ最初の一言から始める。 */
async function fetchConversation(plotId: string, viewpoint: Viewpoint): Promise<Loaded> {
  type Res = { conversation: { id: string } | null; messages: Stored[] };
  let res = await api<Res>(`/api/conversation?plotId=${plotId}&viewpoint=${viewpoint}`);
  if (res.status === 401) return { kind: "gate" };
  if (res.ok && !res.data.conversation) {
    res = await api<Res>(`/api/conversation`, { method: "POST", body: JSON.stringify({ plotId, viewpoint }) });
  }
  if (!res.ok || !res.data.conversation) return { kind: "error" };
  return { kind: "ok", id: res.data.conversation.id, messages: res.data.messages };
}

export function ChatScreen() {
  const params = useParams<{ plotId: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const plot = getPlot(params.plotId);
  const requested = search.get("v") as Viewpoint | null;
  const viewpoint: Viewpoint | undefined =
    plot && requested && plot.viewpoints.includes(requested) ? requested : plot?.viewpoints[0];

  const [phase, setPhase] = useState<"loading" | "gate" | "ready">("loading");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [input, setInput] = useState("");
  const [editing, setEditing] = useState<{ key: string; text: string } | null>(null);
  const [card, setCard] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const applyLoaded = useCallback((r: Loaded) => {
    if (r.kind === "gate") return setPhase("gate");
    if (r.kind === "error") {
      setNotice({ kind: "error", message: "物語を読み込めませんでした。ページを再読み込みしてください。" });
      return setPhase("ready");
    }
    setConversationId(r.id);
    setMessages(r.messages.map(fromStored));
    setPhase("ready");
  }, []);

  const loadConversation = useCallback(() => {
    if (!plot || !viewpoint) return;
    void fetchConversation(plot.id, viewpoint).then(applyLoaded);
  }, [plot, viewpoint, applyLoaded]);

  useEffect(() => {
    if (!plot || !viewpoint) return;
    let alive = true;
    void fetchConversation(plot.id, viewpoint).then((r) => {
      if (alive) applyLoaded(r);
    });
    return () => {
      alive = false;
      abortRef.current?.abort();
    };
  }, [plot, viewpoint, applyLoaded]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  async function stream(body: { message?: string; regenerate?: boolean }, optimisticUser?: UIMessage) {
    if (!conversationId) return;
    setBusy(true);
    setNotice(null);
    const placeholder: UIMessage = { key: nextKey(), role: "assistant", content: "", streaming: true };
    setMessages((prev) => [...prev, ...(optimisticUser ? [optimisticUser] : []), placeholder]);
    const update = (fn: (m: UIMessage) => UIMessage) =>
      setMessages((prev) => prev.map((m) => (m.key === placeholder.key ? fn(m) : m)));
    const drop = (keys: string[]) => setMessages((prev) => prev.filter((m) => !keys.includes(m.key)));

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversationId, ...body }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
        drop([placeholder.key, ...(optimisticUser ? [optimisticUser.key] : [])]);
        if (res.status === 401) return setPhase("gate");
        setNotice({ kind: data.code === "daily_limit" ? "limit" : "error", message: data.error ?? "送信できませんでした" });
        if (body.message) setInput(body.message);
        return;
      }
      for await (const e of readEvents(res)) {
        switch (e.t) {
          case "meta":
            if (optimisticUser && e.userMessageId) {
              const id = e.userMessageId;
              setMessages((prev) => prev.map((m) => (m.key === optimisticUser.key ? { ...m, id } : m)));
            }
            break;
          case "d":
            update((m) => ({ ...m, content: m.content + e.v }));
            break;
          case "replace":
            update((m) => ({ ...m, content: e.v, flagged: true }));
            break;
          case "done":
            update((m) => ({ ...m, id: e.messageId, streaming: false }));
            break;
          case "notice":
            setNotice({ kind: e.kind, message: e.message, link: e.link });
            break;
          case "blocked":
            drop([placeholder.key, ...(optimisticUser ? [optimisticUser.key] : [])]);
            setNotice({ kind: "blocked", message: e.message });
            if (body.message) setInput(body.message);
            break;
          case "error":
            drop([placeholder.key]);
            setNotice({ kind: "error", message: e.message });
            break;
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        drop([placeholder.key]);
        setNotice({ kind: "error", message: "通信が途切れました。もう一度試してください。" });
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  function send(text: string) {
    const t = text.trim();
    if (!t || busy) return;
    setInput("");
    void stream({ message: t }, { key: nextKey(), role: "user", content: t });
  }

  function regenerate() {
    if (busy) return;
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      return last?.role === "assistant" && prev.length > 1 ? prev.slice(0, -1) : prev;
    });
    void stream({ regenerate: true });
  }

  async function saveEdit() {
    if (!editing) return;
    const target = messages.find((m) => m.key === editing.key);
    if (!target?.id) return;
    const res = await api<{ error?: string }>(`/api/messages/${target.id}`, {
      method: "PATCH",
      body: JSON.stringify({ content: editing.text }),
    });
    if (!res.ok) return setNotice({ kind: "error", message: res.data.error ?? "保存できませんでした" });
    setMessages((prev) => prev.map((m) => (m.key === editing.key ? { ...m, content: editing.text, flagged: false } : m)));
    setEditing(null);
  }

  async function restart() {
    if (!plot || !viewpoint || busy) return;
    if (!window.confirm("この物語を最初から始めます。今までの会話は残りません。よろしいですか？")) return;
    const res = await api<{ conversation: { id: string }; messages: Stored[] }>(`/api/conversation`, {
      method: "POST",
      body: JSON.stringify({ plotId: plot.id, viewpoint }),
    });
    if (!res.ok) return setNotice({ kind: "error", message: "最初から始められませんでした" });
    setConversationId(res.data.conversation.id);
    setMessages(res.data.messages.map(fromStored));
    setNotice(null);
  }

  function insertAction() {
    const el = inputRef.current;
    const start = el?.selectionStart ?? input.length;
    const end = el?.selectionEnd ?? input.length;
    const next = `${input.slice(0, start)}*${input.slice(start, end)}*${input.slice(end)}`;
    setInput(next);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + 1, end + 1);
    });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const finePointer = window.matchMedia("(pointer: fine)").matches;
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && finePointer) {
      e.preventDefault();
      send(input);
    }
  }

  if (!plot || !viewpoint) {
    return (
      <main className="mx-auto max-w-xl px-5 py-16">
        <p className="text-mist">この物語は見つかりませんでした。</p>
        <Link href="/" className="mt-4 inline-block text-tint underline">
          物語の一覧に戻る
        </Link>
      </main>
    );
  }

  const last = messages[messages.length - 1];
  const solo = plot.personas.length === 1;
  const starters = messages.length === 1 && !busy ? plot.starterReplies[viewpoint] ?? [] : [];

  return (
    <div style={{ "--hue": plot.hue } as React.CSSProperties} className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 border-b border-line bg-night/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center gap-3 px-4 py-3">
          <Link href="/" aria-label="物語の一覧へ" className="-ml-1 rounded p-1 text-mist hover:text-paper">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-mincho text-lg leading-tight">{plot.title}</h1>
            <p className="truncate text-xs text-tint">{plot.personas.map((p) => p.name).join("と")}</p>
          </div>
          <button onClick={restart} disabled={busy || phase !== "ready"} className="text-xs text-mist hover:text-paper disabled:opacity-40">
            最初から
          </button>
        </div>
        {plot.viewpoints.length > 1 && (
          <div className="mx-auto flex max-w-xl gap-2 px-4 pb-3">
            {plot.viewpoints.map((v) => (
              <button
                key={v}
                onClick={() => {
                  if (v === viewpoint) return;
                  setPhase("loading");
                  setMessages([]);
                  router.replace(`/chat/${plot.id}?v=${v}`);
                }}
                aria-pressed={v === viewpoint}
                className={`rounded-full px-3 py-1 text-xs ${v === viewpoint ? "bg-tint text-night" : "border border-line text-mist"}`}
              >
                {VIEWPOINT_LABEL[v]}
              </button>
            ))}
          </div>
        )}
      </header>

      {phase === "gate" ? (
        <AgeGate onDone={() => void loadConversation()} />
      ) : (
        <main className="mx-auto w-full max-w-xl flex-1 px-5 pb-6 pt-6">
          {phase === "loading" && <p className="text-sm text-mist">物語を開いています</p>}
          <ol className="space-y-7">
            {messages.map((m) => (
              <li key={m.key}>
                {m.role === "user" ? (
                  <div className="ml-auto w-fit max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm border border-line bg-night-2 px-4 py-2.5 text-[0.95rem] leading-7">
                    {parseStory(m.content).map((p, i) =>
                      p.kind === "narration" ? (
                        <span key={i} className="block text-[0.85rem] text-mist">
                          {p.text}
                        </span>
                      ) : (
                        <span key={i} className="block">
                          {p.text}
                        </span>
                      ),
                    )}
                  </div>
                ) : (
                  <article className="border-l-2 border-tint/60 pl-4">
                    {solo && <p className="mb-1.5 text-xs text-tint">{plot.personas[0].name}</p>}
                    {editing?.key === m.key ? (
                      <div>
                        <textarea
                          value={editing.text}
                          onChange={(e) => setEditing({ key: m.key, text: e.target.value })}
                          rows={8}
                          className="w-full rounded-lg border border-line bg-night-2 p-3 font-mincho text-[0.98rem] leading-8"
                        />
                        <div className="mt-2 flex gap-3 text-sm">
                          <button onClick={saveEdit} className="rounded-full bg-paper px-4 py-1.5 font-semibold text-night">
                            保存する
                          </button>
                          <button onClick={() => setEditing(null)} className="px-2 text-mist">
                            やめる
                          </button>
                        </div>
                      </div>
                    ) : m.streaming && !m.content ? (
                      <p className="typing flex gap-1.5 py-2 text-tint" aria-label="返事を書いています">
                        <span>●</span>
                        <span>●</span>
                        <span>●</span>
                      </p>
                    ) : (
                      <StoryText text={m.content} />
                    )}
                    {!m.streaming && m.id && editing?.key !== m.key && (
                      <div className="mt-2 flex gap-4 text-xs text-mist">
                        {m === last && messages.length > 1 && (
                          <>
                            <button onClick={regenerate} disabled={busy} className="hover:text-paper disabled:opacity-40">
                              書き直してもらう
                            </button>
                            <button onClick={() => setEditing({ key: m.key, text: m.content })} className="hover:text-paper">
                              自分で直す
                            </button>
                          </>
                        )}
                        {!m.flagged && (
                          <button onClick={() => setCard(m.content)} className="text-tint hover:text-paper">
                            名場面カードにする
                          </button>
                        )}
                      </div>
                    )}
                  </article>
                )}
              </li>
            ))}
          </ol>
          {last?.role === "user" && !busy && phase === "ready" && (
            <button onClick={regenerate} className="mt-4 text-sm text-tint underline">
              返事をもう一度もらう
            </button>
          )}
          <div ref={bottomRef} />
        </main>
      )}

      {phase === "ready" && (
        <footer className="sticky bottom-0 border-t border-line bg-night/95 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
          <div className="mx-auto max-w-xl px-4 pt-3">
            {notice && (
              <div role="status" className="mb-3 rounded-lg border border-amber/40 px-3 py-2 text-xs leading-6 text-amber">
                {notice.message}
                {notice.link && (
                  <a href={notice.link} target="_blank" rel="noopener noreferrer" className="ml-1 underline">
                    相談できる窓口を見る
                  </a>
                )}
              </div>
            )}
            {starters.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {starters.map((s) => (
                  <button key={s} onClick={() => send(s)} className="rounded-full border border-tint/50 px-3 py-1.5 text-left text-xs text-paper hover:bg-night-2">
                    {s}
                  </button>
                ))}
              </div>
            )}
            {notice?.kind !== "limit" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  send(input);
                }}
                className="flex items-end gap-2"
              >
                <button
                  type="button"
                  onClick={insertAction}
                  title="*で囲むと行動や情景になります"
                  className="shrink-0 rounded-full border border-line px-3 py-2.5 text-xs text-mist hover:text-paper"
                >
                  行動
                </button>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  rows={1}
                  maxLength={2000}
                  placeholder={viewpoint === "watch" ? "見たい展開を書く" : "話しかける"}
                  aria-label="メッセージ"
                  className="max-h-40 min-h-11 flex-1 resize-none rounded-2xl border border-line bg-night-2 px-4 py-2.5 text-base leading-6 placeholder:text-mist/70 focus:border-tint focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={busy || !input.trim()}
                  className="shrink-0 rounded-full bg-paper px-4 py-2.5 text-sm font-semibold text-night disabled:opacity-40"
                >
                  送る
                </button>
              </form>
            )}
          </div>
        </footer>
      )}

      {card && <SceneCard plot={plot} viewpoint={viewpoint} text={card} onClose={() => setCard(null)} />}
    </div>
  );
}
