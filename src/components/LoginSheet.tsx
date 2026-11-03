"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "@/lib/client";
import { isNativeApp } from "@/lib/native";

type Provider = "line" | "google" | "apple";

const LABEL: Record<Provider, string> = { line: "LINE でログイン", google: "Google でログイン", apple: "Apple でサインイン" };

function Mark({ p }: { p: Provider }) {
  if (p === "line")
    return (
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden fill="currentColor">
        <path d="M12 3C6.5 3 2 6.6 2 11c0 3.9 3.5 7.2 8.3 7.9.3.1.8.2.9.5.1.3.1.7 0 1l-.1.9c0 .3-.2 1 .9.5s6-3.5 8.2-6.1C21.6 14.2 22 12.7 22 11c0-4.4-4.5-8-10-8z" />
      </svg>
    );
  if (p === "google")
    return (
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
        <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7z" />
        <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z" />
        <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8l4-3.1z" />
        <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z" />
      </svg>
    );
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden fill="currentColor">
      <path d="M16.4 12.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9-1.7 0-3.3 1-4.2 2.6-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8 1.6 0 2 .8 3.4.8s2.3-1.3 3.1-2.5c1-1.4 1.4-2.8 1.4-2.9 0 0-2.7-1-2.7-4.1zM13.9 5c.7-.9 1.2-2 1-3.2-1 0-2.3.7-3 1.6-.7.8-1.2 2-1.1 3.1 1.2.1 2.3-.6 3.1-1.5z" />
    </svg>
  );
}

const STYLE: Record<Provider, string> = {
  line: "bg-[#06C755] text-white",
  google: "bg-white text-[#1f1f1f]",
  apple: "bg-white text-black",
};

/** ログインのボタンの並び。アプリの中では Google を出さない（Google はアプリの中の画面でのログインを受け付けないため） */
export function LoginButtons({ providers, returnTo }: { providers: Provider[]; returnTo: string }) {
  const [native] = useState(() => isNativeApp());
  const shown = providers.filter((p) => !(native && p === "google"));
  if (shown.length === 0) return <p className="text-sm text-mist">ログインはまだ準備中です。</p>;
  return (
    <div className="space-y-2.5">
      {shown.map((p) => (
        // ログインの画面へは、ページごと移る
        <a
          key={p}
          href={`/api/auth/${p}/start?return=${encodeURIComponent(returnTo)}`}
          className={`press flex h-12 w-full items-center justify-center gap-2.5 rounded-xl text-[0.92rem] font-bold ${STYLE[p]}`}
        >
          <Mark p={p} />
          {LABEL[p]}
        </a>
      ))}
    </div>
  );
}

const TEXT = {
  limit: { title: "続きは、ログインして話そう", body: "ゲストで話せる回数を使い切りました。ログインすると、ここまでの会話をそのまま引き継いで、続きを話し放題になります。" },
  save: { title: "会話と作品を保存する", body: "ログインすると、機種変更やブラウザを変えても、会話と作った作品を引き継げます。ゲストのあいだの記録も、そのまま残ります。" },
  returning: { title: "ログインして続きから", body: "前にログインしたアカウントで、続きから遊べます。" },
};

/** ログインをすすめるシート（ゲストの上限・設定・年齢確認の画面から開く） */
export function LoginSheet({ reason, onClose, returnTo }: { reason: keyof typeof TEXT; onClose: () => void; returnTo?: string }) {
  const [providers, setProviders] = useState<Provider[] | null>(null);
  const [back] = useState(() => returnTo ?? (typeof window === "undefined" ? "/" : window.location.pathname + window.location.search));
  useEffect(() => {
    void api<{ providers?: Provider[] }>("/api/session").then((r) => setProviders(r.data.providers ?? []));
  }, []);
  const t = TEXT[reason];
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal
        aria-label={t.title}
        onClick={(e) => e.stopPropagation()}
        className="arrive w-full max-w-sm rounded-t-3xl bg-night-2 px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-6 sm:rounded-3xl"
      >
        <p className="text-[1.05rem] font-black">{t.title}</p>
        <p className="mt-2 text-[0.85rem] leading-6 text-mist">{t.body}</p>
        <div className="mt-5">{providers ? <LoginButtons providers={providers} returnTo={back} /> : <div className="h-12 rounded-xl bg-night-3" />}</div>
        <p className="mt-4 text-[0.7rem] leading-5 text-mist/80">
          使うのは、アカウントを見分けるための情報だけです。名前やメールアドレスは保存せず、投稿もしません。ログアウト・退会はいつでもできます。
        </p>
        <button onClick={onClose} className="press mt-3 w-full py-2.5 text-sm font-bold text-mist">
          {reason === "limit" ? "あとで" : "閉じる"}
        </button>
      </div>
    </div>,
    document.body,
  );
}
