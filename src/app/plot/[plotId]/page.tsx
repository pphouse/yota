import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Avatar } from "@/components/Avatar";
import { BackIcon } from "@/components/icons";
import { StartButtons } from "@/components/StartButtons";
import { callName, getPlot, PLOTS, pronouns, type Persona } from "@/lib/characters";

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

      {plot.cover && (
        <div className="relative h-[52vh] max-h-[34rem] [mask-image:linear-gradient(to_bottom,black_55%,transparent)]">
          <Image src={plot.cover} alt="" fill sizes="(min-width: 576px) 576px, 100vw" preload className="object-cover object-[50%_15%]" />
        </div>
      )}

      <div className={`relative px-5 ${plot.cover ? "-mt-16" : "pt-6"}`}>
        <h1 className="break-phrase text-balance text-[1.6rem] font-black leading-snug">{plot.title}</h1>
        <p className="break-phrase mt-2 text-[0.95rem] leading-7 text-paper/90">{plot.catchphrase}</p>
        <p className="mt-3 text-[0.78rem] font-medium leading-6 text-mist">{plot.tags.map((t) => `#${t}`).join(" ")}</p>
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
            {plot.personas.map(callName).join("と")}に会いにいく
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
          <p className="mt-1 text-[0.8rem] text-paper/80">
            {p.age}歳{p.height ? `・${p.height}cm` : ""}
          </p>
        </div>
      </div>
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
