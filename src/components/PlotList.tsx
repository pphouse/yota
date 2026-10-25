"use client";

import Link from "next/link";
import { useState } from "react";
import { AvatarStack } from "@/components/Avatar";
import type { Plot, Viewpoint } from "@/lib/characters";
import { track } from "@/lib/client";

const TABS: { id: Viewpoint; label: string; hint: string }[] = [
  { id: "self", label: "あなたが主人公", hint: "キャラがあなたに話しかけます" },
  { id: "watch", label: "ふたりを見守る", hint: "あなたは登場せず、ふたりのやりとりを眺めます" },
];

const mix = (c: string, pct: number) => `color-mix(in oklab, ${c} ${pct}%, #1d1838)`;

/** 表紙の地。ひとりなら推し色、ふたりなら斜めに二色で分ける */
function coverBackground(plot: Plot): string {
  const [a, b] = plot.personas;
  if (!b) return `radial-gradient(130% 90% at 85% 0%, ${mix(a.color, 62)} 0%, ${mix(a.color, 24)} 75%)`;
  return `linear-gradient(150deg, ${mix(a.color, 52)} 0 51%, ${mix(b.color, 46)} 51% 100%)`;
}

function Cover({ plot, viewpoint }: { plot: Plot; viewpoint: Viewpoint }) {
  const lead = plot.personas[0];
  return (
    <Link
      href={`/chat/${plot.id}?v=${viewpoint}`}
      className="press group block"
      aria-label={`${plot.title}　${plot.catchphrase}`}
    >
      <div
        className="relative aspect-[3/4.7] overflow-hidden rounded-[6px] shadow-[0_10px_24px_-12px_rgba(0,0,0,0.7)]"
        style={{ background: coverBackground(plot) }}
      >
        {/* 背表紙の折り目 */}
        <span aria-hidden className="absolute inset-y-0 left-0 w-[7px] bg-black/25" />
        <span aria-hidden className="absolute inset-y-0 left-[7px] w-px bg-white/15" />

        <div className="absolute left-4 top-3.5">
          <AvatarStack personas={plot.personas} size={26} />
        </div>
        <h2
          aria-label={plot.title}
          className="tategaki absolute right-3 top-3.5 font-mincho text-[1.2rem] font-bold leading-[1.4] tracking-[0.1em] text-paper [text-shadow:0_1px_8px_rgba(0,0,0,0.35)]"
        >
          {plot.coverLines.map((line) => (
            <span key={line} className="block">
              {line.split(/(\d+)/).map((seg, i) =>
                /^\d+$/.test(seg) ? (
                  <span key={i} className="[text-combine-upright:all]">
                    {seg}
                  </span>
                ) : (
                  seg
                ),
              )}
            </span>
          ))}
        </h2>

        {/* 帯 */}
        <div
          className="absolute inset-x-0 bottom-0 flex h-[36%] flex-col justify-between gap-1 pb-2.5 pl-[18px] pr-3 pt-2.5"
          style={{ background: `color-mix(in oklab, ${lead.color} 16%, #fbf8ff)` }}
        >
          <p className="line-clamp-3 font-mincho text-[0.78rem] font-bold leading-[1.5] text-night">{plot.catchphrase}</p>
          <p className="truncate text-[0.62rem] text-night/55">{plot.personas.map((p) => p.name).join(" × ")}</p>
        </div>
      </div>
      <p className="mt-2 truncate px-0.5 text-[0.72rem] text-mist">{plot.tags.map((t) => `#${t}`).join(" ")}</p>
    </Link>
  );
}

export function PlotList({ plots }: { plots: Plot[] }) {
  const [tab, setTab] = useState<Viewpoint>("self");
  const shown = plots.filter((p) => p.viewpoints.includes(tab));

  return (
    <section>
      <div role="tablist" aria-label="遊び方" className="grid grid-cols-2 rounded-full bg-night-2 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => {
              setTab(t.id);
              track("viewpoint_select", { viewpoint: t.id, where: "home" });
            }}
            className={`press rounded-full py-2.5 text-sm font-medium ${
              tab === t.id ? "bg-paper text-night" : "text-mist hover:text-paper"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <p className="mt-3 text-center text-xs text-mist">{TABS.find((t) => t.id === tab)?.hint}</p>

      <ul className="mt-6 grid grid-cols-2 gap-x-3.5 gap-y-6 sm:grid-cols-3">
        {shown.map((plot) => (
          <li key={plot.id}>
            <Cover plot={plot} viewpoint={tab} />
          </li>
        ))}
      </ul>
    </section>
  );
}
