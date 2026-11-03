"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "@/lib/client";
import { isNativeApp } from "@/lib/native";

export type Provider = "line" | "google" | "apple" | "email";
type OAuthProvider = Exclude<Provider, "email">;

const LABEL: Record<OAuthProvider, string> = { line: "LINE でログイン", google: "Google でログイン", apple: "Apple でサインイン" };

/**
 * この画面で出すログインの手段。アプリの中ではメールアドレスだけにする
 * （Google はアプリの中の画面でのログインを受け付けない。アプリはゲストの上限がないので、ほかのサービスでのログインはいらない）
 */
export function visibleProviders(providers: Provider[], native: boolean): Provider[] {
  return native ? providers.filter((p) => p === "email") : providers;
}

function Mark({ p }: { p: OAuthProvider }) {
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

const STYLE: Record<OAuthProvider, string> = {
  line: "bg-[#06C755] text-white",
  google: "bg-white text-[#1f1f1f]",
  apple: "bg-white text-black",
};

/** ログインのあとに戻る URL（知らせを出すための印を付ける） */
const withLoginOk = (returnTo: string) => `${returnTo}${returnTo.includes("?") ? "&" : "?"}login=ok`;

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="m4 7 8 6 8-6" />
    </svg>
  );
}

const field =
  "h-12 w-full rounded-xl bg-night-3 px-4 text-base text-paper placeholder:text-mist/60 focus:outline-none focus:ring-2 focus:ring-brand/70";

/** メールアドレスでのログイン：アドレスを入れる → 届いた6けたのコードを入れる */
function EmailLogin({ returnTo, open: openAtFirst }: { returnTo: string; open: boolean }) {
  const [step, setStep] = useState<"closed" | "email" | "code">(openAtFirst ? "email" : "closed");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    const r = await api<{ ok?: boolean; error?: string }>("/api/auth/email/start", { method: "POST", body: JSON.stringify({ email }) });
    setBusy(false);
    if (!r.ok) return setError(r.data.error ?? "送れませんでした。もう一度お試しください。");
    setCode("");
    setStep("code");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await api<{ ok?: boolean; error?: string }>("/api/auth/email/verify", { method: "POST", body: JSON.stringify({ email, code }) });
    if (!r.ok) {
      setBusy(false);
      return setError(r.data.error ?? "ログインできませんでした。もう一度お試しください。");
    }
    // ログインしたアカウントで、ページを読み込み直す
    window.location.href = withLoginOk(returnTo);
  }

  if (step === "closed") {
    return (
      <button onClick={() => setStep("email")} className="press flex h-12 w-full items-center justify-center gap-2.5 rounded-xl bg-night-3 text-[0.92rem] font-bold text-paper">
        <MailIcon />
        メールアドレスでログイン
      </button>
    );
  }
  return (
    <div className="rounded-2xl bg-night-3/60 p-3.5">
      {step === "email" ? (
        <form onSubmit={send} className="space-y-2.5">
          <label className="block text-xs font-bold text-mist">
            メールアドレス
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              inputMode="email"
              placeholder="you@example.com"
              className={`${field} mt-1.5`}
            />
          </label>
          <button type="submit" disabled={busy || !email.trim()} className="press btn-brand h-12 w-full rounded-xl text-[0.92rem]">
            {busy ? "送っています…" : "コードを送る"}
          </button>
          <p className="text-[0.72rem] leading-5 text-mist/80">6けたのコードをメールで送ります。パスワードはいりません。</p>
        </form>
      ) : (
        <form onSubmit={verify} className="space-y-2.5">
          <p className="break-all text-[0.8rem] leading-6 text-mist">
            <span className="font-bold text-paper">{email}</span> に6けたのコードを送りました（10分のあいだ使えます）。
          </p>
          <input
            required
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^0-9０-９]/g, "").slice(0, 6))}
            autoComplete="one-time-code"
            inputMode="numeric"
            aria-label="6けたのコード"
            placeholder="123456"
            className={`${field} text-center text-xl font-bold tracking-[0.4em]`}
          />
          <button type="submit" disabled={busy || code.length !== 6} className="press btn-brand h-12 w-full rounded-xl text-[0.92rem]">
            {busy ? "確かめています…" : "ログインする"}
          </button>
          <div className="flex justify-between text-[0.75rem] font-bold text-mist">
            <button type="button" onClick={() => setStep("email")} className="press underline underline-offset-4">
              アドレスを変える
            </button>
            <button type="button" onClick={() => send()} disabled={busy} className="press underline underline-offset-4">
              コードを送り直す
            </button>
          </div>
          <p className="text-[0.72rem] leading-5 text-mist/80">届かないときは、迷惑メールのフォルダも見てください。</p>
        </form>
      )}
      {error && (
        <p role="alert" className="mt-2.5 text-[0.8rem] leading-5 text-amber">
          {error}
        </p>
      )}
    </div>
  );
}

/** ログインのボタンの並び。アプリの中ではメールアドレスだけ（visibleProviders） */
export function LoginButtons({ providers, returnTo, autoOpen = false }: { providers: Provider[]; returnTo: string; autoOpen?: boolean }) {
  const [native] = useState(() => isNativeApp());
  const shown = visibleProviders(providers, native);
  if (shown.length === 0) return <p className="text-sm text-mist">ログインはまだ準備中です。</p>;
  const oauth = shown.filter((p): p is OAuthProvider => p !== "email");
  return (
    <div className="space-y-2.5">
      {oauth.map((p) => (
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
      {/* ログインのシートで、メールだけのときは、はじめから入力欄を開いておく（設定の画面では開かない：キーボードが急に出ないように） */}
      {shown.includes("email") && <EmailLogin returnTo={returnTo} open={autoOpen && oauth.length === 0} />}
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
        <div className="mt-5">{providers ? <LoginButtons providers={providers} returnTo={back} autoOpen /> : <div className="h-12 rounded-xl bg-night-3" />}</div>
        <p className="mt-4 text-[0.7rem] leading-5 text-mist/80">
          使うのは、アカウントを見分けるための情報だけです。メールアドレスはコードを送るためだけに使い、名前やメールアドレスをそのままの形で保存することはありません。投稿もしません。ログアウト・退会はいつでもできます。
        </p>
        <button onClick={onClose} className="press mt-3 w-full py-2.5 text-sm font-bold text-mist">
          {reason === "limit" ? "あとで" : "閉じる"}
        </button>
      </div>
    </div>,
    document.body,
  );
}
