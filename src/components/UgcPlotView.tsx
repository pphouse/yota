"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { FeedbackSheet } from "@/components/FeedbackSheet";
import { BackIcon } from "@/components/icons";
import { Profile } from "@/components/Profile";
import { StartButtons } from "@/components/StartButtons";
import { TextJacket } from "@/components/TextJacket";
import type { Plot } from "@/lib/characters";
import { api } from "@/lib/client";

type Meta = { id: string; author: string; status: "private" | "pending" | "public"; jacketStatus: "none" | "pending" | "ready" | "failed" };
type Loaded = { plot: Plot; meta: Meta; isOwner: boolean };

const STATUS_TEXT: Record<Meta["status"], string> = {
  private: "リンクを知っている人だけが遊べます",
  pending: "「みんなの作品」への掲載を確認しています",
  public: "「みんなの作品」に載っています",
};

/** ユーザーが作った作品の紹介ページ。作者には、掲載の申請・取り下げ・削除のボタンを出す */
export function UgcPlotView() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<Loaded | null | "missing">(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await api<Loaded>(`/api/plots/${encodeURIComponent(id)}`);
    setData(r.ok ? r.data : "missing");
    return r.ok ? r.data : null;
  }, [id]);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let tries = 0;
    // ジャケットの絵を作っている間は、できるまで数秒おきに見に行く（最大3分）
    const tick = async () => {
      const d = await load();
      if (alive && d?.meta.jacketStatus === "pending" && tries++ < 36) timer = setTimeout(tick, 5000);
    };
    void tick();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [load]);

  async function act(action: "submit" | "withdraw" | "delete") {
    if (action === "delete" && !confirm("この作品を削除しますか？ 元に戻せません。")) return;
    setBusy(true);
    await api(`/api/ugc/${id}`, { method: "PATCH", body: JSON.stringify({ action }) });
    setBusy(false);
    if (action === "delete") router.push("/");
    else void load();
  }

  async function share() {
    const url = window.location.href.split("?")[0];
    if (navigator.share) {
      await navigator.share({ title: data && data !== "missing" ? data.plot.title : "yota", url }).catch(() => {});
      return;
    }
    await navigator.clipboard.writeText(url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (data === null) return <p className="mx-auto max-w-xl px-5 py-16 text-sm text-mist">読み込み中…</p>;
  if (data === "missing") {
    return (
      <main className="mx-auto max-w-xl px-5 py-16">
        <p className="text-mist">この作品は見つかりませんでした。</p>
        <Link href="/" className="mt-4 inline-block font-bold text-brand underline">
          物語の一覧に戻る
        </Link>
      </main>
    );
  }

  const { plot, meta, isOwner } = data;
  return (
    <main className="mx-auto w-full max-w-xl pb-24">
      <header className="sticky top-0 z-20 bg-night/80 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="flex h-12 items-center gap-2 px-3">
          <Link href="/" aria-label="物語の一覧へ" className="press grid size-9 place-items-center rounded-full text-mist hover:text-paper">
            <BackIcon size={22} />
          </Link>
          <p className="truncate text-[0.95rem] font-bold">{plot.title}</p>
        </div>
      </header>

      <div className="px-5 pt-3">
        <div className="relative mx-auto aspect-[3/4] w-full max-w-[24rem] overflow-hidden rounded-3xl bg-night-2 shadow-2xl shadow-black/40">
          {plot.jacket ? <Image src={plot.jacket} alt={plot.title} fill unoptimized className="object-cover" /> : <TextJacket plot={plot} generating={meta.jacketStatus === "pending"} />}
        </div>
      </div>

      <div className="px-5 pt-6">
        <h1 className="break-phrase text-balance text-[1.6rem] font-black leading-snug">{plot.title}</h1>
        <p className="break-phrase mt-2 text-[0.95rem] leading-7 text-paper/90">{plot.catchphrase}</p>
        <p className="mt-3 text-[0.78rem] font-medium leading-6 text-mist">{plot.tags.map((t) => `#${t}`).join(" ")}</p>
        <p className="mt-1 text-[0.8rem] text-paper/80">作：{meta.author}</p>

        <div className="mt-6">
          <Suspense fallback={<div className="h-14 rounded-2xl bg-night-3" />}>
            <StartButtons plot={plot} />
          </Suspense>
        </div>
        <button onClick={share} className="press mt-3 w-full rounded-2xl bg-night-3 py-3 text-sm font-bold">
          {copied ? "リンクをコピーしました" : "リンクを送って遊んでもらう"}
        </button>

        {isOwner && (
          <section className="mt-6 rounded-2xl bg-night-2 px-4 py-4">
            <h2 className="text-[0.78rem] font-bold text-brand">あなたの作品</h2>
            <p className="mt-1 text-[0.88rem] leading-6 text-paper/90">{STATUS_TEXT[meta.status]}</p>
            {meta.jacketStatus === "failed" && <p className="mt-1 text-xs text-amber">ジャケットの絵は作れませんでした。文字だけのジャケットで表示しています。</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href={`/create?id=${meta.id}`} className="press rounded-full bg-paper px-4 py-2 text-sm font-bold text-night">
                直す
              </Link>
              {meta.status === "private" && (
                <button disabled={busy} onClick={() => act("submit")} className="press btn-brand rounded-full px-4 py-2 text-sm">
                  「みんなの作品」への掲載を申請する
                </button>
              )}
              {meta.status === "pending" && (
                <button disabled={busy} onClick={() => act("withdraw")} className="press rounded-full bg-night-3 px-4 py-2 text-sm font-bold">
                  申請を取り下げる
                </button>
              )}
              <button disabled={busy} onClick={() => act("delete")} className="press rounded-full px-3 py-2 text-sm font-bold text-mist hover:text-paper">
                削除する
              </button>
            </div>
          </section>
        )}

        <section className="mt-10">
          <h2 className="text-[1.15rem] font-black">紹介</h2>
          <p className="break-phrase mt-3 whitespace-pre-wrap text-[0.95rem] leading-[1.95] text-paper/90">{plot.intro}</p>
        </section>
        {plot.role && plot.viewpoints.includes("self") && (
          <section className="mt-8 rounded-2xl bg-night-2 px-4 py-3.5">
            <h2 className="text-[0.78rem] font-bold text-brand">あなたの役</h2>
            <p className="break-phrase mt-1 text-[0.9rem] leading-7 text-paper/90">{plot.role}</p>
          </section>
        )}
        <section className="mt-10">
          <h2 className="text-[1.15rem] font-black">登場人物</h2>
          <ul className="mt-4 space-y-4">
            {plot.personas.map((p) => (
              <li key={p.name}>
                <Profile persona={p} />
              </li>
            ))}
          </ul>
        </section>
        <div className="mt-10 text-xs leading-6 text-mist/80">
          <p>ユーザーが作った作品です。登場人物はすべて架空の18歳以上の人物です。返答はAIが生成しています。</p>
          {!isOwner && (
            <p className="mt-2">
              <FeedbackSheet label="この作品を通報する" defaultCategory="report" context={`作品：${plot.id}`} />
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
