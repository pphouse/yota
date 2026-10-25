"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { VIEWPOINT_LABEL, type Plot, type Viewpoint } from "@/lib/characters";

/**
 * 紹介ページの「物語をはじめる」。一覧で選んでいた遊び方（?v=）があれば、それを大きいボタンにする。
 * 見守りもある作品では、もう一方の遊び方を小さいボタンで並べる。
 */
export function StartButtons({ plot }: { plot: Plot }) {
  const search = useSearchParams();
  const requested = search.get("v") as Viewpoint | null;
  const first = requested && plot.viewpoints.includes(requested) ? requested : plot.viewpoints[0];
  const others = plot.viewpoints.filter((v) => v !== first);
  return (
    <div className="flex flex-col gap-2.5">
      <Link href={`/chat/${plot.id}?v=${first}`} className="press btn-brand block rounded-2xl py-4 text-center text-base">
        物語をはじめる
        {plot.viewpoints.length > 1 && <span className="ml-1.5 text-[0.8rem] font-bold opacity-85">（{VIEWPOINT_LABEL[first]}）</span>}
      </Link>
      {others.map((v) => (
        <Link key={v} href={`/chat/${plot.id}?v=${v}`} className="press block rounded-2xl bg-night-3 py-3 text-center text-sm font-bold text-paper">
          {VIEWPOINT_LABEL[v]}
        </Link>
      ))}
    </div>
  );
}
