"use client";

import { useEffect, useState } from "react";
import { PlotCard } from "@/components/PlotList";
import type { Plot } from "@/lib/characters";
import { api } from "@/lib/client";

type Item = { plot: Plot; meta: { id: string; author: string; status: "private" | "pending" | "public"; official?: boolean } };

const STATUS_NOTE: Record<Item["meta"]["status"], string> = {
  private: "リンクで公開中",
  pending: "掲載を確認中",
  public: "みんなの作品に掲載中",
};

function Rail({ title, items, mine = false, official = false }: { title: string; items: Item[]; mine?: boolean; official?: boolean }) {
  if (items.length === 0) return null;
  return (
    <section aria-label={title} className="mt-9">
      <h2 className="px-5 text-[1.15rem] font-black">{title}</h2>
      <ul className="rail mt-3 flex snap-x gap-3 overflow-x-auto scroll-px-5 px-5 pb-1">
        {items.map(({ plot, meta }) => (
          <li key={plot.id} className="w-[44%] shrink-0 snap-start">
            <PlotCard plot={plot} author={mine || official ? undefined : meta.author} note={mine ? STATUS_NOTE[meta.status] : undefined} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** ホームの「新作」（運営が管理者画面から足した作品）・「みんなの作品」（承認済み）・「あなたの作品」 */
export function UgcShelves() {
  const [officialItems, setOfficial] = useState<Item[]>([]);
  const [publicItems, setPublic] = useState<Item[]>([]);
  const [mine, setMine] = useState<Item[]>([]);
  useEffect(() => {
    void api<{ items: Item[] }>("/api/ugc?scope=official").then((r) => r.ok && setOfficial(r.data.items));
    void api<{ items: Item[] }>("/api/ugc").then((r) => r.ok && setPublic(r.data.items));
    void api<{ items: Item[] }>("/api/ugc?scope=mine").then((r) => r.ok && setMine(r.data.items));
  }, []);
  return (
    <>
      <Rail title="新作" items={officialItems} official />
      <Rail title="みんなの作品" items={publicItems} />
      <Rail title="あなたの作品" items={mine} mine />
    </>
  );
}
