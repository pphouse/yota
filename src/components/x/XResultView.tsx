"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { BackIcon } from "@/components/icons";
import { TextJacket } from "@/components/TextJacket";
import { callName, type Plot } from "@/lib/characters";
import { api } from "@/lib/client";

type Result = {
  id: string;
  status: "working" | "ready" | "failed";
  handle: string;
  name: string;
  type: string;
  roasts: string[];
  sweet: string;
  plot: Plot | null;
  plotId: string | null;
  isOwner: boolean;
  error: string | null;
};

const STEPS = ["投稿を読む", "Xのクセを診断する", "あなたに刺さる彼をつくる"];

/** 「Xから生まれる彼」の結果。作っているあいだは進み具合を出し、できたら彼のツッコミと作品を見せる */
export function XResultView() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Result | null>(null);
  const [missing, setMissing] = useState(false);
  const [step, setStep] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let tries = 0;
    const load = async () => {
      const r = await api<Result>(`/api/x/results/${encodeURIComponent(id)}`);
      if (!alive) return;
      if (!r.ok) return setMissing(true);
      setData(r.data);
      // できるまで（3分まで）取り直す。彼の作品ができたあとも、ジャケットの絵ができるまで少し待つ
      const waitingJacket = r.data.status === "ready" && r.data.plot && !r.data.plot.jacket && tries < 40;
      if ((r.data.status === "working" && tries < 90) || waitingJacket) {
        tries++;
        timer = setTimeout(load, 2500);
      }
    };
    void load();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [id]);

  // 作っているあいだの、段階の表示（実際の進み具合ではなく、待ち時間の目安）
  useEffect(() => {
    if (data?.status !== "working") return;
    const t = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 4000);
    return () => clearInterval(t);
  }, [data?.status]);

  const url = typeof window === "undefined" ? "" : `${window.location.origin}/x/${id}`;
  const he = data?.plot?.personas[0];

  function shareText() {
    if (!data || !he) return "";
    return `私のXから生まれた彼は「${he.name}」でした。タイプは「${data.type}」らしい。\n#Xから生まれる彼 #yota`;
  }

  async function copy() {
    await navigator.clipboard?.writeText(`${shareText()}\n${url}`).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <main className="mx-auto w-full max-w-xl pb-16">
      <header className="sticky top-0 z-20 bg-night/85 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="flex h-12 items-center gap-2 px-3">
          <Link href="/x" aria-label="Xから生まれる彼へ" className="press grid size-9 place-items-center rounded-full text-mist hover:text-paper">
            <BackIcon size={22} />
          </Link>
          <p className="text-[0.95rem] font-bold">Xから生まれる彼</p>
        </div>
      </header>

      <div className="px-5 pt-4">
        {missing && <p className="py-10 text-sm text-mist">結果が見つかりません。</p>}
        {!data && !missing && <p className="py-10 text-sm text-mist">読み込み中…</p>}

        {data?.status === "working" && (
          <section className="py-8">
            <p className="text-[0.8rem] font-bold text-brand">@{data.handle}</p>
            <h1 className="mt-1 text-[1.4rem] font-black leading-snug">あなたのXを読んでいます…</h1>
            <ol className="mt-6 space-y-3">
              {STEPS.map((s, i) => (
                <li key={s} className={`flex items-center gap-3 text-[0.95rem] ${i <= step ? "text-paper" : "text-mist/50"}`}>
                  <span className={`grid size-6 place-items-center rounded-full text-[0.7rem] font-black ${i < step ? "bg-paper text-night" : i === step ? "animate-pulse bg-brand text-white" : "bg-night-3"}`}>
                    {i < step ? "✓" : i + 1}
                  </span>
                  {s}
                </li>
              ))}
            </ol>
            <p className="mt-6 text-xs leading-6 text-mist">30秒ほどかかります。このページを閉じても、あとで同じリンクから結果を見られます。</p>
          </section>
        )}

        {data?.status === "failed" && (
          <section className="py-8">
            <h1 className="text-[1.2rem] font-black">うまく作れませんでした</h1>
            <p className="mt-2 text-sm leading-7 text-mist">
              {data.error === "minor" ? "この診断は、18歳以上の方だけが使えます。" : "時間をおいて、もう一度お試しください。"}
            </p>
            <Link href="/x" className="press mt-5 inline-block rounded-full bg-night-3 px-5 py-2.5 text-sm font-bold">
              戻る
            </Link>
          </section>
        )}

        {data?.status === "ready" && data.plot && he && (
          <>
            <section>
              <p className="text-[0.8rem] font-bold text-brand">@{data.handle} のX診断</p>
              <h1 className="mt-1 text-[1.7rem] font-black leading-snug">「{data.type}」</h1>
              <div className="mt-5 flex gap-2.5">
                <Avatar persona={he} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="text-[0.75rem] font-bold" style={{ color: he.color }}>
                    {callName(he)}
                  </p>
                  <ul className="mt-1 space-y-2">
                    {data.roasts.map((r) => (
                      <li key={r} className="w-fit rounded-2xl rounded-tl-md bg-night-3 px-3.5 py-2.5 text-[0.9rem] leading-6">
                        {r}
                      </li>
                    ))}
                    <li className="w-fit rounded-2xl rounded-tl-md bg-brand-grad px-3.5 py-2.5 text-[0.9rem] font-bold leading-6 text-white">{data.sweet}</li>
                  </ul>
                </div>
              </div>
            </section>

            <section className="mt-8 overflow-hidden rounded-3xl bg-night-2">
              <div className="flex gap-4 p-4">
                <div className="relative aspect-[3/4] w-28 shrink-0 overflow-hidden rounded-xl bg-night-3">
                  {data.plot.jacket ? (
                    <Image src={data.plot.jacket} alt="" fill sizes="112px" unoptimized className="object-cover" />
                  ) : (
                    <TextJacket plot={data.plot} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[0.7rem] font-bold text-mist">あなたのXから生まれた彼</p>
                  <p className="mt-1 text-[1.15rem] font-black">
                    {he.name}
                    <span className="ml-1.5 text-[0.8rem] font-bold text-mist">{he.age}歳</span>
                  </p>
                  <p className="mt-1 text-[0.82rem] leading-6 text-paper/85">{data.plot.catchphrase}</p>
                  <p className="mt-1 truncate text-[0.72rem] text-mist">『{data.plot.title}』</p>
                </div>
              </div>
              <div className="space-y-2 px-4 pb-4">
                <Link href={`/chat/${data.plot.id}?v=self`} className="press btn-brand block rounded-2xl py-3.5 text-center text-[0.95rem]">
                  {data.isOwner ? "彼と話す" : "彼と話してみる"}
                </Link>
                {data.isOwner && (
                  <div className="grid grid-cols-2 gap-2">
                    <Link href={`/u/${data.plot.id}`} className="press rounded-2xl bg-night-3 py-3 text-center text-sm font-bold">
                      彼のプロフィール
                    </Link>
                    <Link href={`/create?id=${data.plot.id}`} className="press rounded-2xl bg-night-3 py-3 text-center text-sm font-bold">
                      彼の設定を直す
                    </Link>
                  </div>
                )}
              </div>
            </section>

            {data.isOwner ? (
              <section className="mt-6">
                <a
                  href={`https://x.com/intent/post?text=${encodeURIComponent(shareText())}&url=${encodeURIComponent(url)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="press block rounded-2xl bg-paper py-3.5 text-center text-[0.95rem] font-black text-night"
                >
                  結果をXでシェアする
                </a>
                <button onClick={copy} className="press mt-2 w-full rounded-2xl bg-night-3 py-3 text-sm font-bold">
                  {copied ? "コピーしました" : "リンクをコピー"}
                </button>
              </section>
            ) : (
              <Link href="/x" className="press mt-6 block rounded-2xl bg-paper py-3.5 text-center text-[0.95rem] font-black text-night">
                あなたのXからも、彼をつくる
              </Link>
            )}
            <p className="mt-6 text-xs leading-6 text-mist/80">診断と彼は、AIが投稿の傾向から作った架空のものです。登場人物はすべて18歳以上の架空の人物です。</p>
          </>
        )}
      </div>
    </main>
  );
}
