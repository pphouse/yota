"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { api } from "@/lib/client";
import { NOTE_CATEGORIES, type NoteCategory } from "@/lib/feedback";
import { storedRef } from "@/lib/ref";

/** ホームの下の「ご意見・不具合を送る」。感想・不具合・要望を、いつでも送れる */
export function FeedbackSheet() {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<NoteCategory>("impression");
  const [text, setText] = useState("");
  const [contact, setContact] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    const r = await api("/api/feedback", {
      method: "POST",
      body: JSON.stringify({ kind: "note", category, text, ...(contact.trim() ? { contact } : {}), ref: storedRef() }),
    });
    if (!r.ok) return setState("error");
    setState("sent");
    setText("");
    setContact("");
  }

  function close() {
    setOpen(false);
    if (state === "sent") setState("idle");
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="press font-bold text-paper/90 underline underline-offset-4">
        ご意見・不具合を送る
      </button>
      {open &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" onClick={close}>
            <form
              onSubmit={send}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-t-3xl bg-night-2 px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-6 sm:rounded-3xl"
            >
              {state === "sent" ? (
                <>
                  <p className="text-base font-bold">ありがとうございます！</p>
                  <p className="mt-2 text-sm leading-6 text-mist">いただいた声は、すべて読んでいます。これからの物語づくりに使わせていただきます。</p>
                  <button type="button" onClick={close} className="press btn-brand mt-5 w-full rounded-2xl py-3.5 text-sm">
                    閉じる
                  </button>
                </>
              ) : (
                <>
                  <p className="text-base font-bold">ご意見・不具合を送る</p>
                  <div role="radiogroup" aria-label="種類" className="mt-4 flex flex-wrap gap-1.5">
                    {(Object.keys(NOTE_CATEGORIES) as NoteCategory[]).map((c) => (
                      <button
                        key={c}
                        type="button"
                        role="radio"
                        aria-checked={category === c}
                        onClick={() => setCategory(c)}
                        className={`press rounded-full px-3.5 py-1.5 text-[0.8rem] font-bold ${category === c ? "bg-paper text-night" : "bg-night-3 text-mist hover:text-paper"}`}
                      >
                        {NOTE_CATEGORIES[c]}
                      </button>
                    ))}
                  </div>
                  <textarea
                    autoFocus
                    required
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    maxLength={1000}
                    rows={5}
                    aria-label="内容"
                    placeholder={category === "bug" ? "どの作品で、何をしたら、どうなったか" : "好きなキャラ、ほしい作品、気になったところなど"}
                    className="mt-3 w-full rounded-2xl bg-night-3 px-4 py-3 text-sm leading-6 placeholder:text-mist/70 focus:outline-none focus:ring-2 focus:ring-brand/70"
                  />
                  <label className="mt-3 block text-xs font-bold text-mist">
                    返事がほしい場合の連絡先（任意。X のアカウントなど）
                    <input
                      value={contact}
                      onChange={(e) => setContact(e.target.value)}
                      maxLength={100}
                      className="mt-1.5 w-full rounded-2xl bg-night-3 px-4 py-3 text-sm text-paper focus:outline-none focus:ring-2 focus:ring-brand/70"
                    />
                  </label>
                  {state === "error" && (
                    <p role="alert" className="mt-3 text-sm text-amber">
                      送れませんでした。もう一度お試しください。
                    </p>
                  )}
                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <button type="button" onClick={close} className="press rounded-2xl bg-night-3 py-3.5 text-sm font-bold">
                      やめる
                    </button>
                    <button type="submit" disabled={state === "sending" || !text.trim()} className="press btn-brand rounded-2xl py-3.5 text-sm">
                      {state === "sending" ? "送っています" : "送る"}
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>,
          document.body,
        )}
    </>
  );
}
