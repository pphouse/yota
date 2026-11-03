"use client";

import { useEffect, useState } from "react";

const ERRORS: Record<string, string> = {
  needs_age: "はじめての方は、先に年齢の確認をしてください。そのあとでログインできます。",
  cancel: "ログインをやめました。",
  state: "ログインの途中で時間が切れました。もう一度お試しください。",
  unavailable: "このログインは、まだ準備中です。",
  failed: "ログインできませんでした。少し時間をおいてお試しください。",
};

/** ログインから戻ってきたときの知らせ（?login=ok / ?login_error=…）。出したら URL から消す */
export function LoginToast() {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    const url = new URL(window.location.href);
    const ok = url.searchParams.get("login");
    const err = url.searchParams.get("login_error");
    if (!ok && !err) return;
    url.searchParams.delete("login");
    url.searchParams.delete("login_error");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    // 表示は少し遅らせる（画面の読み込みと重ねない）
    const show = setTimeout(() => setText(ok ? "ログインしました。会話と作品はこのアカウントに保存されます。" : (ERRORS[err ?? ""] ?? ERRORS.failed)), 50);
    const hide = setTimeout(() => setText(null), 5000);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, []);
  if (!text) return null;
  return (
    <div role="status" className="arrive fixed inset-x-0 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[60] mx-auto w-fit max-w-[92%] rounded-2xl bg-paper px-4 py-2.5 text-center text-[0.82rem] font-bold text-night shadow-xl">
      {text}
    </div>
  );
}
