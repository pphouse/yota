"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CloseIcon, RestartIcon, SendIcon } from "@/components/icons";
import { AssistantMessage, SceneNarration, UserMessage } from "@/components/StoryMessage";
import type { Viewpoint } from "@/lib/characters";
import { api } from "@/lib/client";
import { forTrial, toPlot } from "@/lib/ugc-schema";
import { fillUser, nameInNarration, nameInProse } from "@/lib/username";

type Msg = { role: "user" | "assistant"; content: string };

/** 「試しに話す」：書きかけの作品で、保存せずに会話を試す。閉じると会話は消える */
export function TrySheet({ payload, userName, onClose }: { payload: Record<string, unknown>; userName: string; onClose: () => void }) {
  const viewpoints = (payload.viewpoints as Viewpoint[]) ?? ["self"];
  const [viewpoint, setViewpoint] = useState<Viewpoint>(viewpoints[0]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const trial = forTrial(payload, viewpoint);
  const plot = trial.ok ? toPlot("u-trial", trial.input) : null;
  const name = viewpoint === "self" ? userName : "";
  const opening = plot ? fillUser(plot.opening[viewpoint] ?? "", name) : "";
  const prologue = plot ? fillUser(plot.prologue ?? "", name) : "";

  // 新しいブラウザの scrollIntoView は Promise を返すので、値を返さない形で呼ぶ（返すと後片付けの関数と見なされる）
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, busy]);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    const content = text.trim();
    if (!content || busy) return;
    const next = [...messages, { role: "user" as const, content }];
    setMessages(next);
    setText("");
    setBusy(true);
    setError(null);
    const r = await api<{ reply?: string; error?: string }>("/api/ugc/try", {
      method: "POST",
      body: JSON.stringify({ plot: payload, viewpoint, messages: next }),
    });
    setBusy(false);
    if (!r.ok || !r.data.reply) {
      setError(r.data.error ?? "返事を作れませんでした");
      setMessages(messages);
      setText(content);
      return;
    }
    setMessages([...next, { role: "assistant", content: r.data.reply }]);
  }

  return createPortal(
    <div role="dialog" aria-modal aria-label="試しに話す" className="fixed inset-0 z-50 flex flex-col bg-night">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-white/5 px-3 pt-[env(safe-area-inset-top)]">
        <button onClick={onClose} aria-label="閉じる" className="press grid size-9 place-items-center rounded-full text-mist hover:text-paper">
          <CloseIcon size={20} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.9rem] font-bold">試しに話す</p>
          <p className="text-[0.66rem] text-mist">保存されません。閉じて直して、また試せます</p>
        </div>
        {viewpoints.length > 1 && (
          <div role="radiogroup" aria-label="遊び方" className="flex rounded-full bg-night-3 p-0.5">
            {viewpoints.map((v) => (
              <button
                key={v}
                role="radio"
                aria-checked={viewpoint === v}
                onClick={() => {
                  setViewpoint(v);
                  setMessages([]);
                  setError(null);
                }}
                className={`press rounded-full px-2.5 py-1 text-[0.7rem] font-bold ${viewpoint === v ? "bg-paper text-night" : "text-mist"}`}
              >
                {v === "self" ? "主人公" : "見守る"}
              </button>
            ))}
          </div>
        )}
        <button
          onClick={() => {
            setMessages([]);
            setError(null);
          }}
          aria-label="最初から"
          className="press grid size-9 place-items-center rounded-full text-mist hover:text-paper"
        >
          <RestartIcon size={18} />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-xl space-y-6 px-4 py-5">
          {!plot ? (
            <p className="text-sm leading-7 text-mist">
              {trial.ok ? "" : `話すには、${trial.missing.map((m) => m.label).join("・")}を書いてください。`}
            </p>
          ) : (
            <>
              {prologue && <SceneNarration text={viewpoint === "self" ? nameInProse(prologue, name) : prologue} />}
              <AssistantMessage text={viewpoint === "self" ? nameInNarration(opening, name) : opening} personas={plot.personas} watch={viewpoint === "watch"} />
              {messages.map((m, i) =>
                m.role === "user" ? (
                  <UserMessage key={i} text={m.content} watch={viewpoint === "watch"} />
                ) : (
                  <AssistantMessage key={i} text={m.content} personas={plot.personas} watch={viewpoint === "watch"} />
                ),
              )}
              {busy && <AssistantMessage text="" streaming personas={plot.personas} />}
            </>
          )}
          {error && (
            <p role="alert" className="text-sm text-amber">
              {error}
            </p>
          )}
          <div ref={endRef} />
        </div>
      </div>

      <form onSubmit={send} className="shrink-0 border-t border-white/5 bg-night-2/80 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3">
        <div className="mx-auto flex max-w-xl items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) send(e);
            }}
            rows={1}
            maxLength={500}
            disabled={!plot}
            aria-label="メッセージ"
            placeholder={viewpoint === "watch" ? "見たい展開や、つぶやきを送る" : "話しかける（*行動* も書けます）"}
            className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl bg-night-3 px-4 py-2.5 text-[0.92rem] leading-6 placeholder:text-mist/60 focus:outline-none focus:ring-2 focus:ring-brand/60"
          />
          <button type="submit" disabled={!text.trim() || busy || !plot} aria-label="送る" className="press btn-brand grid size-11 shrink-0 place-items-center rounded-full">
            <SendIcon size={18} />
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
