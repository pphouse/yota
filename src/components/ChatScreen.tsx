"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AgeGate } from "@/components/AgeGate";
import { SceneCard } from "@/components/SceneCard";
import { AvatarStack } from "@/components/Avatar";
import { BackIcon, CardIcon, PenIcon, RestartIcon, RetryIcon, SendIcon } from "@/components/icons";
import { AssistantMessage, SceneNarration, UserMessage } from "@/components/StoryMessage";
import { getPlot, VIEWPOINT_LABEL, type Viewpoint } from "@/lib/characters";
import { api, readEvents, track } from "@/lib/client";
import { Typewriter } from "@/lib/typewriter";
import { nameInProse } from "@/lib/username";

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

type Loaded = { kind: "gate" } | { kind: "name" } | { kind: "error" } | { kind: "ok"; id: string; messages: Stored[]; name: string };

/** その作品・視点の会話を読み込む。まだなければ最初の一言から始める。年齢の確認や名前がまだなら、先にそれを聞く */
async function fetchConversation(plotId: string, viewpoint: Viewpoint): Promise<Loaded> {
  const me = await api<{ session: { name: string } | null }>("/api/session");
  if (me.ok && !me.data.session) return { kind: "gate" };
  if (me.ok && !me.data.session?.name) return { kind: "name" };
  type Res = { conversation: { id: string } | null; messages: Stored[] };
  let res = await api<Res>(`/api/conversation?plotId=${plotId}&viewpoint=${viewpoint}`);
  if (res.status === 401) return { kind: "gate" };
  if (res.ok && !res.data.conversation) {
    res = await api<Res>(`/api/conversation`, { method: "POST", body: JSON.stringify({ plotId, viewpoint }) });
  }
  if (!res.ok || !res.data.conversation) return { kind: "error" };
  return { kind: "ok", id: res.data.conversation.id, messages: res.data.messages, name: me.data.session?.name ?? "" };
}

export function ChatScreen() {
  const params = useParams<{ plotId: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const plot = getPlot(params.plotId);
  const requested = search.get("v") as Viewpoint | null;
  const viewpoint: Viewpoint | undefined =
    plot && requested && plot.viewpoints.includes(requested) ? requested : plot?.viewpoints[0];

  const [phase, setPhase] = useState<"loading" | "gate" | "name" | "ready">("loading");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [messages, setMessages] = useState<UIMessage[]>([]);
  // receiving = 返答を受け取っている途中、revealing = 受け取り終えて、残りを画面に見せている途中
  const [turn, setTurn] = useState<"idle" | "receiving" | "revealing">("idle");
  const busy = turn !== "idle";
  const [notice, setNotice] = useState<Notice | null>(null);
  const [input, setInput] = useState("");
  const [editing, setEditing] = useState<{ key: string; text: string } | null>(null);
  const [card, setCard] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<{ forId: string; items: string[] } | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const typerRef = useRef<Typewriter | null>(null);
  const turnRef = useRef<Promise<void>>(Promise.resolve());
  const suggestRequested = useRef<string | null>(null);
  // 直近2回分の候補。次の候補で同じ物や動作を繰り返さないよう、サーバーに渡す
  const lastSuggestions = useRef<string[]>([]);
  const composingRef = useRef(false);
  const compositionEndRef = useRef(0);
  const stickRef = useRef(true);

  const applyLoaded = useCallback((r: Loaded) => {
    if (r.kind === "gate" || r.kind === "name") return setPhase(r.kind);
    if (r.kind === "error") {
      setNotice({ kind: "error", message: "物語を読み込めませんでした。ページを再読み込みしてください。" });
      return setPhase("ready");
    }
    setConversationId(r.id);
    setUserName(r.name);
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
      typerRef.current?.cancel();
    };
  }, [plot, viewpoint, applyLoaded]);

  // 読み返すために上へ戻っているときは、自動で下へ送らない
  useEffect(() => {
    const onScroll = () => {
      stickRef.current = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 160;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // 下に固定した入力欄に隠れないよう、ページの一番下まで送る
  useEffect(() => {
    if (stickRef.current) window.scrollTo({ top: document.documentElement.scrollHeight });
  }, [messages]);

  // キャラが返すたびに、次の返事の候補を作ってもらう（最初の一言には作品ごとの候補を使う）。
  // 受け取りが終わった時点で頼むので、文章を見せ終える頃には届いている
  useEffect(() => {
    if (phase !== "ready" || turn === "receiving" || !conversationId || messages.length < 2) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role !== "assistant" || !lastMsg.id || lastMsg.flagged) return;
    if (suggestRequested.current === lastMsg.id) return;
    const forId = lastMsg.id;
    suggestRequested.current = forId;
    void api<{ suggestions?: string[] }>("/api/suggest", {
      method: "POST",
      body: JSON.stringify({ conversationId, messageId: forId, previous: lastSuggestions.current }),
    }).then((r) => {
      if (!r.ok || !r.data.suggestions?.length) return;
      lastSuggestions.current = [...r.data.suggestions, ...lastSuggestions.current].slice(0, 6);
      setSuggestions({ forId, items: r.data.suggestions });
    });
  }, [phase, turn, conversationId, messages]);

  async function stream(body: { message?: string; regenerate?: boolean }, optimisticUser?: UIMessage) {
    if (!conversationId) return;
    setTurn("receiving");
    setNotice(null);
    stickRef.current = true;
    const placeholder: UIMessage = { key: nextKey(), role: "assistant", content: "", streaming: true };
    setMessages((prev) => [...prev, ...(optimisticUser ? [optimisticUser] : []), placeholder]);
    const update = (fn: (m: UIMessage) => UIMessage) =>
      setMessages((prev) => prev.map((m) => (m.key === placeholder.key ? fn(m) : m)));
    const drop = (keys: string[]) => setMessages((prev) => prev.filter((m) => !keys.includes(m.key)));
    // 文章AIは長文でも一瞬で返してくるので、届いた分を貯めて、人が書くくらいの速さで見せる
    const typer = new Typewriter((text) => update((m) => ({ ...m, content: text })));
    typerRef.current = typer;
    let saved = false;

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
        typer.cancel();
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
            typer.push(e.v);
            break;
          case "replace":
            typer.replace(e.v);
            update((m) => ({ ...m, flagged: true }));
            break;
          case "rewrite":
            typer.rewrite(e.v);
            break;
          case "done":
            saved = true;
            update((m) => ({ ...m, id: e.messageId }));
            break;
          case "notice":
            setNotice({ kind: e.kind, message: e.message, link: e.link });
            break;
          case "blocked":
            typer.cancel();
            drop([placeholder.key, ...(optimisticUser ? [optimisticUser.key] : [])]);
            setNotice({ kind: "blocked", message: e.message });
            if (body.message) setInput(body.message);
            break;
          case "error":
            typer.cancel();
            drop([placeholder.key]);
            setNotice({ kind: "error", message: e.message });
            break;
        }
      }
      // 受け取りは終わった。残りを見せ終えるまで待つ（返答をタップすると一気に出せる）
      typer.end();
      setTurn("revealing");
      await typer.done;
      if (saved) update((m) => ({ ...m, streaming: false }));
    } catch (err) {
      typer.cancel();
      if ((err as Error).name !== "AbortError") {
        drop([placeholder.key]);
        setNotice({ kind: "error", message: "通信が途切れました。もう一度試してください。" });
      }
    } finally {
      if (typerRef.current === typer) typerRef.current = null;
      setTurn("idle");
      abortRef.current = null;
    }
  }

  function send(text: string) {
    const t = text.trim();
    if (!t || turn === "receiving") return;
    // 返答を見せている途中なら、残りを一気に出してから送る
    if (turn === "revealing") typerRef.current?.flush();
    setInput("");
    const user: UIMessage = { key: nextKey(), role: "user", content: t };
    turnRef.current = turnRef.current.then(() => stream({ message: t }, user));
  }

  function pick(text: string, index: number, opening: boolean) {
    if (!plot) return;
    track("suggestion_select", { plotId: plot.id, index, opening });
    send(text);
  }

  function regenerate() {
    if (busy) return;
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      return last?.role === "assistant" && prev.length > 1 ? prev.slice(0, -1) : prev;
    });
    turnRef.current = turnRef.current.then(() => stream({ regenerate: true }));
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
    // 返答が変わったので、候補も作り直す
    suggestRequested.current = null;
    setSuggestions(null);
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
    if (e.key !== "Enter" || e.shiftKey) return;
    // 日本語の変換を確定する Enter では送らない。Safari は確定の Enter を compositionend の「あと」に
    // isComposing=false で送ってくるので、keyCode 229 と、確定した直後かどうかでも見分ける
    const native = e.nativeEvent;
    if (native.isComposing || native.keyCode === 229 || composingRef.current) return;
    if (e.timeStamp - compositionEndRef.current < 100) return;
    // スマホでは Enter は改行。送るのはボタンで
    if (!window.matchMedia("(pointer: fine)").matches) return;
    e.preventDefault();
    send(input);
  }

  if (!plot || !viewpoint) {
    return (
      <main className="mx-auto max-w-xl px-5 py-16">
        <p className="text-mist">この物語は見つかりませんでした。</p>
        <Link href="/" className="mt-4 inline-block font-bold text-brand underline">
          物語の一覧に戻る
        </Link>
      </main>
    );
  }

  const last = messages[messages.length - 1];
  const watch = viewpoint === "watch";
  const opening = messages.length === 1;
  // 返事の候補：最初の一言には作品ごとの候補、そのあとはキャラが返すたびに作った候補
  const chips =
    turn === "idle" && last?.role === "assistant" && !last.streaming
      ? opening
        ? plot.starterReplies[viewpoint] ?? []
        : suggestions && suggestions.forId === last.id
          ? suggestions.items
          : []
      : [];
  const pill = "press inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 text-[0.8rem]";
  const subPill = `${pill} bg-night-3 font-bold text-paper disabled:opacity-40`;

  return (
    <div className="relative isolate flex min-h-dvh flex-col">
      {/* 作品の背景。暗くして、上下はさらに地の色へ溶かす。年齢確認のあいだは表紙の絵だけを見せる */}
      {phase !== "gate" && phase !== "name" && (
        <div aria-hidden className="fixed inset-0 -z-10">
          {plot.backdrop && <Image src={plot.backdrop} alt="" fill sizes="100vw" loading="eager" className="object-cover" />}
          <div className="absolute inset-0 bg-night/70" />
          <div className="absolute inset-0 bg-linear-to-b from-night via-transparent to-night" />
        </div>
      )}
      <header className="sticky top-0 z-10 bg-night/75 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-xl items-center gap-3 px-3 py-2.5">
          <Link href="/" aria-label="物語の一覧へ" className="press grid size-9 place-items-center rounded-full text-mist hover:text-paper">
            <BackIcon size={22} />
          </Link>
          <AvatarStack personas={plot.personas} size={36} />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[1rem] font-bold leading-tight">{plot.title}</h1>
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
            <div className="grid grid-cols-2 rounded-full bg-night-2/80 p-0.5">
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
                  className={`press rounded-full py-1.5 text-xs ${v === viewpoint ? "btn-brand" : "font-bold text-mist"}`}
                >
                  {VIEWPOINT_LABEL[v]}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="h-px bg-white/5" />
      </header>

      {phase === "gate" || phase === "name" ? (
        <AgeGate plot={plot} nameOnly={phase === "name"} onDone={() => void loadConversation()} />
      ) : (
        <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-6 pt-5">
          {phase === "loading" && <p className="py-10 text-center text-sm text-mist">物語を開いています</p>}
          {phase === "ready" && (
            // プロローグ：作品の舞台を、物語の入口としてナレーションで見せる
            <div className="mb-6">
              <SceneNarration text={viewpoint === "self" ? nameInProse(plot.setting, userName) : plot.setting} />
            </div>
          )}
          <ol className="space-y-6">
            {messages.map((m) => (
              <li
                key={m.key}
                data-beat
                className={m === last ? "arrive" : undefined}
                // 表示している途中の返答をタップすると、残りを一気に出す
                onClick={m.streaming ? () => typerRef.current?.flush() : undefined}
                {...(m.streaming ? { "data-streaming": "" } : {})}
              >
                {m.role === "user" ? (
                  <UserMessage text={m.content} watch={watch} />
                ) : editing?.key === m.key ? (
                  <div>
                    <textarea
                      value={editing.text}
                      onChange={(e) => setEditing({ key: m.key, text: e.target.value })}
                      rows={8}
                      aria-label="返答を直す"
                      className="w-full rounded-2xl bg-night-3 p-4 text-[0.97rem] leading-8 ring-1 ring-brand/50 focus:outline-none focus:ring-brand"
                    />
                    <div className="mt-2 flex gap-2">
                      <button onClick={saveEdit} className="press btn-brand rounded-full px-5 py-2 text-sm">
                        保存する
                      </button>
                      <button onClick={() => setEditing(null)} className="press px-3 text-sm font-bold text-mist">
                        やめる
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <AssistantMessage text={m.content} personas={plot.personas} streaming={m.streaming} watch={watch} />
                    {!m.streaming && m.id && m === last && (
                      <div className="mt-3 flex flex-wrap gap-2 pl-12">
                        {messages.length > 1 && (
                          <>
                            <button onClick={regenerate} disabled={busy} className={subPill}>
                              <RetryIcon size={15} />
                              書き直す
                            </button>
                            <button onClick={() => setEditing({ key: m.key, text: m.content })} className={subPill}>
                              <PenIcon size={15} />
                              編集
                            </button>
                          </>
                        )}
                        {!m.flagged && m === last && (
                          <button onClick={() => setCard(m.content)} className={`${pill} btn-brand`}>
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
            <button onClick={regenerate} className={`${subPill} mt-4`}>
              <RetryIcon size={15} />
              返事をもう一度もらう
            </button>
          )}
        </main>
      )}

      {phase === "ready" && (
        <footer className="sticky bottom-0 bg-night/75 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl">
          <div className="h-px bg-white/5" />
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
            {chips.length > 0 && (
              <div className="rail arrive mb-2.5 flex gap-2 overflow-x-auto px-4">
                {chips.map((s, i) => (
                  <button
                    key={`${i}-${s}`}
                    data-starter
                    onClick={() => pick(s, i, opening)}
                    className="press shrink-0 rounded-full bg-night-3 px-4 py-2 text-[0.85rem] font-bold text-paper ring-1 ring-brand/35"
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
                  onCompositionStart={() => (composingRef.current = true)}
                  onCompositionEnd={(e) => {
                    composingRef.current = false;
                    compositionEndRef.current = e.timeStamp;
                  }}
                  rows={1}
                  maxLength={2000}
                  placeholder={watch ? "見たい展開を書く" : `${plot.personas.length === 1 ? "話しかける" : "ふたりに話しかける"}`}
                  aria-label="メッセージ"
                  className="max-h-40 min-h-11 flex-1 resize-none rounded-[1.4rem] bg-night-3 px-4 py-2.5 text-base leading-6 placeholder:text-mist/70 focus:outline-none focus:ring-1 focus:ring-brand/60"
                />
                <button
                  type="submit"
                  aria-label="送る"
                  disabled={turn === "receiving" || !input.trim()}
                  className="press btn-brand grid size-11 shrink-0 place-items-center rounded-full"
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
