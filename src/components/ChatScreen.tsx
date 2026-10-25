"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AgeGate } from "@/components/AgeGate";
import { SceneCard } from "@/components/SceneCard";
import { AvatarStack } from "@/components/Avatar";
import { BackIcon, CardIcon, PenIcon, RestartIcon, RetryIcon, SendIcon } from "@/components/icons";
import { AssistantMessage, UserMessage } from "@/components/StoryMessage";
import { getPlot, plotVars, VIEWPOINT_LABEL, type Viewpoint } from "@/lib/characters";
import { api, readEvents } from "@/lib/client";

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

  // 下に固定した入力欄に隠れないよう、ページの一番下まで送る
  useEffect(() => {
    window.scrollTo({ top: document.documentElement.scrollHeight });
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
  const watch = viewpoint === "watch";
  const starters = messages.length === 1 && !busy ? plot.starterReplies[viewpoint] ?? [] : [];
  const pill =
    "press inline-flex h-9 items-center gap-1.5 rounded-full bg-night-3/90 px-3.5 text-[0.8rem] font-bold text-paper backdrop-blur disabled:opacity-40";

  return (
    <div style={plotVars(plot) as React.CSSProperties} className="relative isolate flex min-h-dvh flex-col">
      {plot.backdrop && (
        <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
          <Image src={plot.backdrop} alt="" fill priority sizes="(max-width: 640px) 100vw, 640px" className="object-cover" />
          {/* 文字が読めるよう、背景は夜の色で沈める */}
          <div className="absolute inset-0 bg-night/70" />
          <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(15,15,19,0.6),rgba(15,15,19,0.05)_35%,rgba(15,15,19,0.9))]" />
        </div>
      )}
      <header className="sticky top-0 z-10 bg-night/70 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-xl items-center gap-3 px-3 py-2.5">
          <Link href="/" aria-label="物語の一覧へ" className="press grid size-9 place-items-center rounded-full text-mist hover:text-paper">
            <BackIcon size={22} />
          </Link>
          <AvatarStack personas={plot.personas} size={36} />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[1rem] font-black leading-tight">{plot.title}</h1>
            <p className="mt-0.5 truncate text-[0.72rem] text-mist">{plot.personas.map((p) => p.name).join(" × ")}</p>
          </div>
          <button
            onClick={restart}
            disabled={busy || phase !== "ready"}
            aria-label="最初から"
            title="最初から"
            className="press grid size-9 place-items-center rounded-full text-mist hover:text-paper disabled:opacity-40"
          >
            <RestartIcon size={19} />
          </button>
        </div>
        {plot.viewpoints.length > 1 && (
          <div className="mx-auto max-w-xl px-4 pb-2.5">
            <div className="grid grid-cols-2 rounded-full bg-night-2 p-0.5">
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
                  className={`press rounded-full py-1.5 text-xs font-bold ${v === viewpoint ? "btn-brand" : "text-mist"}`}
                >
                  {VIEWPOINT_LABEL[v]}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="h-px bg-line/70" />
      </header>

      {phase === "gate" ? (
        <AgeGate plot={plot} onDone={() => void loadConversation()} />
      ) : (
        <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-6 pt-5">
          {phase === "loading" && <p className="py-10 text-center text-sm text-mist">物語を開いています</p>}
          <ol className="space-y-6">
            {messages.map((m) => (
              <li key={m.key} data-beat className={m === last ? "arrive" : undefined} {...(m.streaming ? { "data-streaming": "" } : {})}>
                {m.role === "user" ? (
                  <UserMessage text={m.content} watch={watch} />
                ) : editing?.key === m.key ? (
                  <div>
                    <textarea
                      value={editing.text}
                      onChange={(e) => setEditing({ key: m.key, text: e.target.value })}
                      rows={8}
                      aria-label="返答を直す"
                      className="w-full rounded-2xl bg-night-2 p-4 text-[0.98rem] leading-8 ring-1 ring-brand/50 focus:outline-none"
                    />
                    <div className="mt-2 flex gap-2">
                      <button onClick={saveEdit} className="btn-brand press rounded-full px-5 py-2 text-sm">
                        保存する
                      </button>
                      <button onClick={() => setEditing(null)} className="press px-3 text-sm text-mist">
                        やめる
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <AssistantMessage text={m.content} personas={plot.personas} streaming={m.streaming} watch={watch} />
                    {!m.streaming && m.id && m === last && (
                      <div className="mt-3 flex flex-wrap gap-2 pl-[44px]">
                        {messages.length > 1 && (
                          <>
                            <button onClick={regenerate} disabled={busy} className={pill}>
                              <RetryIcon size={15} />
                              書き直す
                            </button>
                            <button onClick={() => setEditing({ key: m.key, text: m.content })} className={pill}>
                              <PenIcon size={15} />
                              編集
                            </button>
                          </>
                        )}
                        {!m.flagged && m === last && (
                          <button
                            onClick={() => setCard(m.content)}
                            className="btn-brand press inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[0.8rem]"
                          >
                            <CardIcon size={15} />
                            カードにする
                          </button>
                        )}
                      </div>
                    )}
                  </>
                )}
              </li>
            ))}
          </ol>
          {last?.role === "user" && !busy && phase === "ready" && (
            <button onClick={regenerate} className={`${pill} mt-4`}>
              <RetryIcon size={15} />
              返事をもう一度もらう
            </button>
          )}
        </main>
      )}

      {phase === "ready" && (
        <footer className="sticky bottom-0 bg-night/80 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl">
          <div className="h-px bg-line/70" />
          <div className="mx-auto max-w-xl pt-2.5">
            {notice && (
              <div role="status" className="mx-4 mb-2.5 rounded-xl border border-amber/40 bg-amber/10 px-3.5 py-2.5 text-xs leading-6 text-amber">
                {notice.message}
                {notice.link && (
                  <a href={notice.link} target="_blank" rel="noopener noreferrer" className="ml-1 underline">
                    相談できる窓口を見る
                  </a>
                )}
              </div>
            )}
            {starters.length > 0 && (
              <div className="rail mb-2.5 flex gap-2 overflow-x-auto px-4">
                {starters.map((s) => (
                  <button
                    key={s}
                    data-starter
                    onClick={() => send(s)}
                    className="press shrink-0 rounded-full bg-night-3 px-4 py-2.5 text-[0.85rem] font-bold text-paper ring-1 ring-brand/35"
                  >
                    {s.replace(/\*/g, "")}
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
                className="flex items-end gap-2 px-3"
              >
                <button
                  type="button"
                  onClick={insertAction}
                  title="*で囲むと行動や情景になります"
                  className="press h-11 shrink-0 rounded-full bg-night-3 px-3.5 text-xs font-bold text-mist hover:text-paper"
                >
                  ＊行動
                </button>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  rows={1}
                  maxLength={2000}
                  placeholder={watch ? "見たい展開を書く" : `${plot.personas.length === 1 ? "話しかける" : "ふたりに話しかける"}`}
                  aria-label="メッセージ"
                  className="max-h-40 min-h-11 flex-1 resize-none rounded-[1.4rem] bg-night-3 px-4 py-2.5 text-base leading-6 placeholder:text-mist/70 focus:outline-none focus:ring-2 focus:ring-brand/60"
                />
                <button
                  type="submit"
                  aria-label="送る"
                  disabled={busy || !input.trim()}
                  className="btn-brand press grid size-11 shrink-0 place-items-center rounded-full"
                >
                  <SendIcon size={20} />
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
