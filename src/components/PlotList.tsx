"use client";

import Link from "next/link";
import { useState } from "react";
import type { Plot, Viewpoint } from "@/lib/characters";
import { track } from "@/lib/client";

const TABS: { id: Viewpoint; label: string; hint: string }[] = [
  { id: "self", label: "あなたが主人公", hint: "キャラがあなたに話しかけます" },
  { id: "watch", label: "ふたりを見守る", hint: "あなたは登場せず、ふたりの関係を眺めます" },
];

export function PlotList({ plots }: { plots: Plot[] }) {
  const [tab, setTab] = useState<Viewpoint>("self");
  const shown = plots.filter((p) => p.viewpoints.includes(tab));

  return (
    <section>
      <div role="tablist" aria-label="遊び方" className="grid grid-cols-2 rounded-full border border-line p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => {
              setTab(t.id);
              track("viewpoint_select", { viewpoint: t.id, where: "home" });
            }}
            className={`rounded-full py-2.5 text-sm transition-colors ${
              tab === t.id ? "bg-paper text-night" : "text-mist hover:text-paper"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <p className="mt-3 text-center text-xs text-mist">{TABS.find((t) => t.id === tab)?.hint}</p>

      <ul className="mt-6 space-y-4">
        {shown.map((plot) => (
          <li key={plot.id}>
            <Link
              href={`/chat/${plot.id}?v=${tab}`}
              style={{ "--hue": plot.hue } as React.CSSProperties}
              className="group block border-l-2 border-tint bg-night-2/60 px-5 py-5 transition-colors hover:bg-night-2"
            >
              <h2 className="font-mincho text-xl leading-snug">{plot.title}</h2>
              <p className="mt-2 text-sm leading-6 text-mist">{plot.catchphrase}</p>
              <p className="mt-3 text-xs text-tint">
                {plot.personas.map((p) => p.name).join("と")}
                <span className="text-mist">　{plot.tags.map((t) => `#${t}`).join(" ")}</span>
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
