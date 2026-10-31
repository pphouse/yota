import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { NewBadge } from "@/components/Badges";
import { BackIcon } from "@/components/icons";
import { StartButtons } from "@/components/StartButtons";
import { Profile } from "@/components/Profile";
import { getPlot, PLOTS } from "@/lib/characters";

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
