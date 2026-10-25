"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { AvatarStack } from "@/components/Avatar";
import type { Plot, Viewpoint } from "@/lib/characters";
import { track } from "@/lib/client";

const TABS: { id: Viewpoint; label: string; hint: string }[] = [
  { id: "self", label: "あなたが主人公", hint: "キャラがあなたに話しかけます" },
  { id: "watch", label: "ふたりを見守る", hint: "あなたは登場せず、ふたりのやりとりを眺めます" },
];

export function PlotCard({ plot, viewpoint }: { plot: Plot; viewpoint?: Viewpoint }) {
  return (
    <Link href={viewpoint ? `/plot/${plot.id}?v=${viewpoint}` : `/plot/${plot.id}`} className="press block" aria-label={`${plot.title}　${plot.catchphrase}`}>
      <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-night-2">
        {plot.cover && (
          <Image src={plot.cover} alt="" fill sizes="(min-width: 576px) 270px, 46vw" className="object-cover object-top" />
        )}
        <span aria-hidden className="absolute inset-x-0 bottom-0 h-3/5 bg-linear-to-t from-black/95 via-black/60 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-3">
          <AvatarStack personas={plot.personas} size={24} />
          <h3 className="break-phrase mt-1.5 line-clamp-2 text-balance text-[0.98rem] font-black leading-snug">{plot.title}</h3>
        </div>
      </div>
      <p className="break-phrase mt-2 line-clamp-2 px-0.5 text-[0.75rem] leading-5 text-mist">{plot.catchphrase}</p>
    </Link>
  );
}

export function PlotList({ plots }: { plots: Plot[] }) {
  const [tab, setTab] = useState<Viewpoint>("self");
  const shown = plots.filter((p) => p.viewpoints.includes(tab));

  return (
    <section className="mt-9 px-5">
      <h2 className="text-[1.15rem] font-black">物語をえらぶ</h2>
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

      <ul className="mt-4 grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3">
        {shown.map((plot) => (
          <li key={plot.id}>
            <PlotCard plot={plot} viewpoint={tab} />
          </li>
        ))}
      </ul>
    </section>
  );
}
