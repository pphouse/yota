"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { AvatarStack } from "@/components/Avatar";
import { callName, type Plot, type Viewpoint } from "@/lib/characters";
import { track } from "@/lib/client";

const TABS: { id: Viewpoint; label: string; hint: string }[] = [
  { id: "self", label: "あなたが主人公", hint: "キャラがあなたに話しかけます" },
  { id: "watch", label: "ふたりを見守る", hint: "あなたは登場せず、ふたりのやりとりを眺めます" },
];

const SHADE = "bg-[linear-gradient(to_bottom,rgba(15,15,19,0)_35%,rgba(15,15,19,0.55)_62%,rgba(15,15,19,0.96))]";

function Art({ plot, sizes, position = "object-[50%_22%]" }: { plot: Plot; sizes: string; position?: string }) {
  if (plot.cover) {
    return <Image src={plot.cover} alt="" fill sizes={sizes} className={`object-cover ${position}`} />;
  }
  const [a, b] = plot.personas;
  return <div className="absolute inset-0" style={{ background: `linear-gradient(150deg, ${a.color}, ${(b ?? a).color})` }} />;
}

function Tags({ tags }: { tags: string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {tags.slice(0, 3).map((t) => (
        <span key={t} className="rounded-md bg-white/10 px-1.5 py-0.5 text-[0.66rem] font-medium text-paper/85 backdrop-blur">
          #{t}
        </span>
      ))}
    </div>
  );
}

/** 一番上の大きな一枚（横にすべらせて切り替える） */
function Featured({ plots, viewpoint }: { plots: Plot[]; viewpoint: Viewpoint }) {
  return (
    <div className="rail -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1">
      {plots.map((plot) => (
        <Link
          key={plot.id}
          href={`/chat/${plot.id}?v=${viewpoint}`}
          className="press relative block aspect-[4/5] w-[84%] shrink-0 snap-center overflow-hidden rounded-3xl bg-night-2"
        >
          <Art plot={plot} sizes="(max-width: 640px) 84vw, 480px" position="object-[50%_15%]" />
          <div className={`absolute inset-0 ${SHADE}`} />
          <div className="absolute inset-x-0 bottom-0 p-5">
            <div className="mb-2.5 flex items-center gap-2">
              <AvatarStack personas={plot.personas} size={28} />
              <span className="text-xs font-bold" style={{ color: plot.personas[0].color }}>
                {plot.personas.map(callName).join(" × ")}
              </span>
            </div>
            <h3 className="text-[1.45rem] font-black leading-tight tracking-tight">{plot.title}</h3>
            <p className="mt-1.5 line-clamp-2 text-[0.85rem] leading-relaxed text-paper/80">{plot.catchphrase}</p>
            <div className="mt-3 flex items-center justify-between gap-3">
              <Tags tags={plot.tags} />
              <span className="btn-brand shrink-0 rounded-full px-4 py-2 text-[0.8rem]">はじめる</span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

function Card({ plot, viewpoint }: { plot: Plot; viewpoint: Viewpoint }) {
  return (
    <Link href={`/chat/${plot.id}?v=${viewpoint}`} className="press group block" aria-label={`${plot.title}　${plot.catchphrase}`}>
      <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-night-2">
        <Art plot={plot} sizes="(max-width: 640px) 46vw, 220px" />
        <div className={`absolute inset-0 ${SHADE}`} />
        <div className="absolute inset-x-0 bottom-0 p-3">
          <h3 className="line-clamp-2 text-[0.95rem] font-bold leading-snug">{plot.title}</h3>
          <p className="mt-1 truncate text-[0.7rem] font-medium" style={{ color: plot.personas[0].color }}>
            {plot.personas.map(callName).join(" × ")}
          </p>
        </div>
      </div>
      <p className="mt-2 line-clamp-2 px-0.5 text-[0.75rem] leading-snug text-mist">{plot.catchphrase}</p>
    </Link>
  );
}

export function PlotList({ plots }: { plots: Plot[] }) {
  const [tab, setTab] = useState<Viewpoint>("self");
  const shown = plots.filter((p) => p.viewpoints.includes(tab));

  return (
    <section>
      <Featured plots={shown} viewpoint={tab} />

      <div className="mt-8 flex items-end justify-between">
        <h2 className="text-lg font-black">物語をえらぶ</h2>
      </div>
      <div role="tablist" aria-label="遊び方" className="mt-3 flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => {
              setTab(t.id);
              track("viewpoint_select", { viewpoint: t.id, where: "home" });
            }}
            className={`press rounded-full px-4 py-2 text-[0.85rem] font-bold ${
              tab === t.id ? "btn-brand" : "bg-night-2 text-mist hover:text-paper"
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
            <Card plot={plot} viewpoint={tab} />
          </li>
        ))}
      </ul>
    </section>
  );
}
