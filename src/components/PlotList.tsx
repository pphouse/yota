"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import { MbtiChip, NewBadge } from "@/components/Badges";
import { GENRES, type Genre, type Plot, type Viewpoint } from "@/lib/characters";
import { track } from "@/lib/client";

const TABS: { id: Viewpoint; label: string; hint: string }[] = [
  { id: "self", label: "あなたが主人公", hint: "あなたも登場人物になって、キャラと話します" },
  { id: "watch", label: "ふたりを見守る", hint: "あなたは登場せず、ふたりの会話を見守ります" },
];

/** 絞りこみ。カテゴリのチップか、カードのハッシュタグで選ぶ */
type Filter = { kind: "genre"; id: Genre } | { kind: "tag"; tag: string } | null;

/**
 * 作品のカード。タイトル文字入りのジャケットをそのまま見せ、その下にタイトル・キャッチコピー・ハッシュタグを置く。
 * note を渡すと、キャッチコピーの代わりに出す（「〜を遊んだあなたに」など）
 */
export function PlotCard({ plot, viewpoint, onTag, note }: { plot: Plot; viewpoint?: Viewpoint; onTag?: (tag: string) => void; note?: string }) {
  return (
    <div>
      <Link href={viewpoint ? `/plot/${plot.id}?v=${viewpoint}` : `/plot/${plot.id}`} className="press block" aria-label={`${plot.title}　${plot.catchphrase}`}>
        <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-night-2">
          {(plot.jacket ?? plot.cover) && (
            <Image src={(plot.jacket ?? plot.cover)!} alt="" fill sizes="(min-width: 576px) 270px, 46vw" className="object-cover object-top" />
          )}
          <div className="absolute inset-x-2 bottom-2 flex items-end justify-between gap-1">
            <MbtiChip personas={plot.personas} />
            <NewBadge plot={plot} />
          </div>
        </div>
        <h3 className="break-phrase mt-2 line-clamp-2 px-0.5 text-[0.95rem] font-black leading-snug">{plot.title}</h3>
      </Link>
      <p className={`break-phrase mt-1 line-clamp-2 px-0.5 text-[0.75rem] leading-5 ${note ? "font-bold text-brand" : "text-mist"}`}>{note ?? plot.catchphrase}</p>
      {onTag && (
        <ul className="mt-1.5 flex flex-wrap gap-1 px-0.5">
          {plot.tags.map((t) => (
            <li key={t}>
              <button
                onClick={() => onTag(t)}
                className="press rounded-full bg-night-3 px-2 py-0.5 text-[0.7rem] font-bold text-paper/80 hover:text-paper"
              >
                #{t}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      aria-pressed={active}
      onClick={onClick}
      className={`press shrink-0 rounded-full px-3.5 py-1.5 text-[0.8rem] font-bold ${
        active ? "bg-paper text-night" : "bg-night-3 text-mist hover:text-paper"
      }`}
    >
      {children}
    </button>
  );
}

export function PlotList({ plots }: { plots: Plot[] }) {
  const [tab, setTab] = useState<Viewpoint>("self");
  const [filter, setFilter] = useState<Filter>(null);
  const top = useRef<HTMLElement>(null);

  const inTab = plots.filter((p) => p.viewpoints.includes(tab));
  // その遊び方に作品がないカテゴリは出さない
  const genres = GENRES.filter((g) => inTab.some((p) => p.genres.includes(g.id)));
  const active = filter?.kind === "genre" && !genres.some((g) => g.id === filter.id) ? null : filter;
  const shown = inTab.filter((p) =>
    !active ? true : active.kind === "genre" ? p.genres.includes(active.id) : p.tags.includes(active.tag),
  );

  const choose = (next: Filter, where: string) => {
    setFilter(next);
    track("genre_select", { genre: next ? (next.kind === "genre" ? next.id : `#${next.tag}`) : "all", where });
  };

  return (
    <section ref={top} className="mt-9 scroll-mt-14 px-5">
      <h2 className="text-[1.15rem] font-black">すべての作品</h2>
      <div role="tablist" aria-label="遊び方" className="rail mt-3 flex gap-2 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => {
              setTab(t.id);
              track("viewpoint_select", { viewpoint: t.id, where: "home" });
            }}
            className={`press shrink-0 rounded-full px-4 py-2 text-[0.85rem] ${
              tab === t.id ? "btn-brand" : "bg-night-3 font-bold text-mist hover:text-paper"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <p className="mt-2.5 text-xs text-mist">{TABS.find((t) => t.id === tab)?.hint}</p>

      <div aria-label="カテゴリ" className="rail -mx-5 mt-4 flex gap-2 overflow-x-auto px-5">
        <Chip active={!active} onClick={() => choose(null, "chip")}>
          すべて
        </Chip>
        {active?.kind === "tag" && (
          <Chip active onClick={() => choose(null, "chip")}>
            #{active.tag}
            <span aria-label="絞りこみを外す" className="ml-1.5 opacity-70">
              ×
            </span>
          </Chip>
        )}
        {genres.map((g) => (
          <Chip key={g.id} active={active?.kind === "genre" && active.id === g.id} onClick={() => choose({ kind: "genre", id: g.id }, "chip")}>
            {g.label}
          </Chip>
        ))}
      </div>

      {shown.length > 0 ? (
        <ul className="mt-5 grid grid-cols-2 gap-x-3 gap-y-6">
          {shown.map((plot) => (
            <li key={plot.id}>
              <PlotCard
                plot={plot}
                viewpoint={tab}
                onTag={(tag) => {
                  choose({ kind: "tag", tag }, "hashtag");
                  top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              />
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-6 rounded-2xl bg-night-2 px-4 py-8 text-center">
          <p className="text-sm text-mist">このタグの作品はまだありません。</p>
          <button onClick={() => choose(null, "empty")} className="press mt-3 rounded-full bg-night-3 px-4 py-2 text-sm font-bold">
            すべての作品を見る
          </button>
        </div>
      )}
    </section>
  );
}
