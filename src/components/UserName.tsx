"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { PenIcon } from "@/components/icons";
import { api } from "@/lib/client";
import { USER_NAME_MAX } from "@/lib/username";

/** ホームの右上。物語の中で呼ばれる名前を見せ、押すと変えられる。年齢確認の前は何も出さない */
export function UserName() {
  const [name, setName] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void api<{ session: { name: string } | null }>("/api/session").then((r) => {
      if (r.ok && r.data.session) setName(r.data.session.name);
    });
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await api<{ session?: { name: string }; error?: string }>("/api/session", {
      method: "PATCH",
      body: JSON.stringify({ name: draft }),
    });
    setBusy(false);
    if (!r.ok || !r.data.session) return setError(r.data.error ?? "変えられませんでした");
    setName(r.data.session.name);
    setEditing(false);
  }

  if (name === null) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setDraft(name);
          setError(null);
          setEditing(true);
        }}
        className="press flex max-w-[11rem] items-center gap-1.5 rounded-full bg-night-3 px-3 py-1.5 text-[0.75rem] font-bold text-paper"
      >
        <span className="truncate">{name || "名前を決める"}</span>
        <PenIcon size={13} className="shrink-0 text-mist" />
      </button>
      {/* ヘッダーの backdrop-blur の中では fixed が画面に対して効かないので、body の直下に出す */}
      {editing &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" onClick={() => setEditing(false)}>
            <form
              onSubmit={save}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-t-3xl bg-night-2 px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-6 sm:rounded-3xl"
            >
              <label className="block text-xs font-bold text-mist">
                物語の中で呼ばれる名前
                <input
                  autoFocus
                  required
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  maxLength={USER_NAME_MAX}
                  autoComplete="nickname"
                  className="mt-1.5 w-full rounded-2xl bg-night-3 px-4 py-3.5 text-base font-bold text-paper focus:outline-none focus:ring-2 focus:ring-brand/70"
                />
              </label>
              <p className="mt-2 text-xs leading-5 text-mist/80">これから始まる会話から、この名前で呼ばれます。</p>
              {error && (
                <p role="alert" className="mt-3 text-sm text-amber">
                  {error}
                </p>
              )}
              <div className="mt-5 grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setEditing(false)} className="press rounded-2xl bg-night-3 py-3.5 text-sm font-bold">
                  やめる
                </button>
                <button type="submit" disabled={busy || !draft.trim()} className="press btn-brand rounded-2xl py-3.5 text-sm">
                  {busy ? "保存しています" : "保存する"}
                </button>
              </div>
            </form>
          </div>,
          document.body,
        )}
    </>
  );
}
