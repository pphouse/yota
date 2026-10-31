"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AgeGate } from "@/components/AgeGate";
import { BackIcon } from "@/components/icons";
import type { Plot } from "@/lib/characters";
import { api } from "@/lib/client";

const GATE_PLOT: Plot = {
  id: "x",
  title: "Xから生まれる彼",
  catchphrase: "",
  tags: [],
  genres: ["daily"],
  viewpoints: ["self"],
  personas: [],
  setting: "",
  opening: { self: undefined, watch: undefined },
  starterReplies: { self: undefined, watch: undefined },
  hooks: [],
  hue: 280,
};

const ERRORS: Record<string, string> = {
  unavailable: "まだ準備中です。もう少しお待ちください。",
  session: "先に年齢の確認をしてください。",
  minor: "この診断は、18歳以上の方だけが使えます。",
  busy: "今日の診断は混み合っています。また明日お試しください。",
  limit: "今日の診断の回数（2回）を使い切りました。また明日お試しください。",
  denied: "Xへのログインがキャンセルされました。",
  state: "ログインの途中で時間が切れました。もう一度お試しください。",
  few: "投稿が少なくて診断できませんでした（5件以上の投稿が必要です）。",
  x: "Xから読み込めませんでした。少し時間をおいてお試しください。",
};

/** 見本（実在の人ではない、架空の結果） */
const SAMPLE = {
  type: "深夜の独り言職人",
  roasts: ["「寝る」って言ってから、3時間後に「寝れない」って言うの、もう様式美だよね", "コーヒーは2杯までって書いてあるけど、守れた日を見たことない", "喫茶店の店主の話、だいたい週3で出てくる"],
  sweet: "……で、今夜は何時に寝るの。付き合うけど",
  name: "朔",
};

/** 「Xから生まれる彼」の入口。Xでログインすると、診断と彼を作る */
export function XStart({ available }: { available: boolean }) {
  const error = useSearchParams().get("error");
  const [phase, setPhase] = useState<"loading" | "gate" | "minor" | "ready">("loading");

  useEffect(() => {
    void api<{ session: { isMinor: boolean } | null }>("/api/session").then((r) => {
      const s = r.ok ? r.data.session : null;
      setPhase(!s ? "gate" : s.isMinor ? "minor" : "ready");
    });
  }, []);

  if (phase === "gate") return <AgeGate plot={GATE_PLOT} onDone={(isMinor) => setPhase(isMinor ? "minor" : "ready")} />;

  return (
    <main className="mx-auto w-full max-w-xl pb-16">
      <header className="sticky top-0 z-20 bg-night/85 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="flex h-12 items-center gap-2 px-3">
          <Link href="/" aria-label="ホームへ" className="press grid size-9 place-items-center rounded-full text-mist hover:text-paper">
            <BackIcon size={22} />
          </Link>
          <p className="text-[0.95rem] font-bold">Xから生まれる彼</p>
        </div>
      </header>
      <div className="px-5 pt-4">
        <p className="text-[0.75rem] font-bold tracking-widest text-brand">X DIAGNOSIS</p>
        <h1 className="mt-2 text-[1.6rem] font-black leading-snug">
          あなたのXから、
          <br />
          彼をつくる。
        </h1>
        <p className="mt-3 text-[0.9rem] leading-7 text-paper/85">
          Xでログインすると、プロフィールと最近の投稿100件をAIが読んで、あなたのXのクセへのツッコミと、あなたに刺さる彼を作ります。できた彼とは、そのまま話せます。
        </p>

        <figure className="mt-6 rounded-3xl bg-night-2 p-4" aria-label="結果の見本">
          <p className="text-[0.68rem] font-bold text-mist">見本</p>
          <p className="mt-1 text-[1.15rem] font-black">「{SAMPLE.type}」</p>
          <ul className="mt-3 space-y-2">
            {SAMPLE.roasts.map((r) => (
              <li key={r} className="rounded-2xl rounded-tl-md bg-night-3 px-3.5 py-2.5 text-[0.85rem] leading-6">
                {r}
              </li>
            ))}
            <li className="rounded-2xl rounded-tl-md bg-brand-grad px-3.5 py-2.5 text-[0.85rem] font-bold leading-6 text-white">{SAMPLE.sweet}</li>
          </ul>
          <figcaption className="mt-2 text-right text-[0.72rem] text-mist">— あなたのXから生まれた{SAMPLE.name}</figcaption>
        </figure>

        {error && ERRORS[error] && (
          <p role="alert" className="mt-5 rounded-2xl bg-amber/10 px-4 py-3 text-sm leading-6 text-amber">
            {ERRORS[error]}
          </p>
        )}

        {phase === "loading" ? (
          <div className="mt-6 h-14 rounded-2xl bg-night-3" />
        ) : phase === "minor" ? (
          <p className="mt-6 text-sm leading-7 text-mist">この診断は、18歳以上の方だけが使えます。</p>
        ) : available ? (
          // X のログイン画面へは、ページごと移る
          <a href="/api/x/login" className="press btn-brand mt-6 flex items-center justify-center gap-2 rounded-2xl py-4 text-base">
            <XLogo /> Xでログインして診断する
          </a>
        ) : (
          <p className="mt-6 rounded-2xl bg-night-3 py-4 text-center text-sm font-bold text-mist">準備中です</p>
        )}

        <ul className="mt-6 space-y-2 text-[0.78rem] leading-6 text-mist">
          <li>・診断できるのは、ログインしたあなた自身のアカウントだけです。ほかの人のアカウントは診断できません。</li>
          <li>・投稿は診断に使うだけで、保存しません。残るのは、診断の結果と彼の作品だけです。</li>
          <li>・読み取りだけです。投稿・いいね・フォローはしません。</li>
          <li>・できる彼は架空の人物です。あなたや、投稿に出てくる人をモデルにはしません。</li>
          <li>・1日2回まで。同じアカウントは3日間、前の結果を出します。</li>
        </ul>
      </div>
    </main>
  );
}

function XLogo() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden fill="currentColor">
      <path d="M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.3L5.3 21H2.2l7.2-8.3L2 3h6.4l4.4 5.8zm-1.1 16.2h1.7L7.4 4.7H5.6z" />
    </svg>
  );
}
