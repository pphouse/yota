import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Avatar } from "@/components/Avatar";
import { NewBadge } from "@/components/Badges";
import { BackIcon } from "@/components/icons";
import { StartButtons } from "@/components/StartButtons";
import { StatRadar } from "@/components/StatRadar";
import { getPlot, PLOTS, pronouns, type Persona } from "@/lib/characters";

export function generateStaticParams() {
  return PLOTS.map((p) => ({ plotId: p.id }));
}

export async function generateMetadata({ params }: PageProps<"/plot/[plotId]">): Promise<Metadata> {
  const plot = getPlot((await params).plotId);
  return plot ? { title: `${plot.title} — yota`, description: plot.catchphrase } : {};
}

/** 作品の紹介ページ。表紙・紹介文・あなたの役・登場人物のプロフィールを見せてから、物語を始めてもらう */
export default async function PlotPage({ params }: PageProps<"/plot/[plotId]">) {
  const plot = getPlot((await params).plotId);
  if (!plot) notFound();
  return (
    <main className="mx-auto w-full max-w-xl pb-36">
      <header className="sticky top-0 z-20 bg-night/80 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="flex h-12 items-center gap-2 px-3">
          <Link href="/" aria-label="物語の一覧へ" className="press grid size-9 place-items-center rounded-full text-mist hover:text-paper">
            <BackIcon size={22} />
          </Link>
          <p className="truncate text-[0.95rem] font-bold">{plot.title}</p>
        </div>
      </header>

      {(plot.jacket ?? plot.cover) && (
        // ジャケットはタイトルの文字入りなので、切らずにそのまま見せる
        <div className="px-5 pt-3">
          <div className="relative mx-auto aspect-[3/4] w-full max-w-[24rem] overflow-hidden rounded-3xl bg-night-2 shadow-2xl shadow-black/40">
            <Image src={(plot.jacket ?? plot.cover)!} alt={plot.title} fill sizes="(min-width: 576px) 384px, 90vw" preload className="object-cover" />
          </div>
        </div>
      )}

      <div className="relative px-5 pt-6">
        <h1 className="break-phrase text-balance text-[1.6rem] font-black leading-snug">{plot.title}</h1>
        <p className="break-phrase mt-2 text-[0.95rem] leading-7 text-paper/90">{plot.catchphrase}</p>
        <p className="mt-3 flex flex-wrap items-center gap-x-2 text-[0.78rem] font-medium leading-6 text-mist">
          <NewBadge plot={plot} />
          {plot.tags.map((t) => `#${t}`).join(" ")}
        </p>
        <div className="mt-6">
          <Suspense fallback={<div className="h-14 rounded-2xl bg-night-3" />}>
            <StartButtons plot={plot} />
          </Suspense>
        </div>

        {plot.intro && (
          <section className="mt-10">
            <h2 className="text-[1.15rem] font-black">紹介</h2>
            <p className="break-phrase mt-3 whitespace-pre-wrap text-[0.95rem] leading-[1.95] text-paper/90">{plot.intro}</p>
          </section>
        )}

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

        <p className="mt-10 text-xs leading-6 text-mist/80">登場人物はすべて架空の18歳以上の人物です。返答はAIが生成しています。</p>
      </div>

      {/* いつでも始められるよう、画面の下にもボタンを置く */}
      <div className="fixed inset-x-0 bottom-0 z-20 bg-linear-to-t from-night via-night/95 to-transparent pb-[calc(1rem+env(safe-area-inset-bottom))] pt-6">
        <div className="mx-auto max-w-xl px-5">
          <Link href={`/chat/${plot.id}`} className="press btn-brand block rounded-2xl py-4 text-center text-base">
            物語をはじめる
          </Link>
        </div>
      </div>
    </main>
  );
}

/** 登場人物のプロフィール。zeta の紹介のように、見た目・性格・好き嫌い・口癖・好きになったら、まで見せる */
function Profile({ persona: p }: { persona: Persona }) {
  const { first, you } = pronouns(p);
  const rows: [string, string | undefined][] = [
    ["見た目", p.profile],
    ["性格", p.personality],
    ["好き", p.likes?.join("、")],
    ["嫌い", p.dislikes?.join("、")],
    ["口癖", p.habits?.map((h) => `「${h}」`).join(" ")],
    ["一人称／二人称", first ? `${first}／${you ?? "名前で呼ぶ"}` : undefined],
    ["好きになったら", p.inLove],
  ];
  return (
    <article className="rounded-3xl bg-night-2 p-4">
      <div className="flex items-center gap-3.5">
        <Avatar persona={p} size={64} />
        <div className="min-w-0">
          <p className="text-[1.1rem] font-black leading-tight" style={{ color: p.color }}>
            {p.name}
          </p>
          {p.reading && <p className="mt-0.5 text-[0.75rem] text-mist">{p.reading}</p>}
          <p className="mt-1 flex items-center gap-2 text-[0.8rem] text-paper/80">
            {p.age}歳{p.height ? `・${p.height}cm` : ""}
            {p.mbti && <span className="rounded-full bg-night-3 px-2 py-0.5 text-[0.7rem] font-bold tracking-wider text-paper">{p.mbti}</span>}
          </p>
        </div>
      </div>
      {p.stats && (
        <div className="mt-4">
          <p className="text-[0.72rem] font-bold text-mist">性格パラメーター</p>
          <StatRadar persona={p} />
          <p className="mt-1 text-center text-[0.7rem] text-mist/80">会話でのふるまいにも反映されます</p>
        </div>
      )}
      <dl className="mt-4 space-y-3">
        {rows
          .filter((r): r is [string, string] => Boolean(r[1]))
          .map(([label, value]) => (
            <div key={label}>
              <dt className="text-[0.72rem] font-bold text-mist">{label}</dt>
              <dd className="break-phrase mt-0.5 text-[0.88rem] leading-7 text-paper/90">{value}</dd>
            </div>
          ))}
      </dl>
    </article>
  );
}
