"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AvatarStack } from "@/components/Avatar";
import { NewBadge } from "@/components/Badges";
import { callName, type Plot } from "@/lib/characters";

/** 自動で次のカードへ送る間隔と、触ったあとに自動送りを止めておく時間 */
const INTERVAL_MS = 5000;
const PAUSE_AFTER_TOUCH_MS = 10000;

/**
 * 注目作。横にすべらせる大きなカード。絵の下側を暗くして、その上に作品の情報を載せる。
 * 5秒ごとに次の作品へ送る（触っている間・触った直後・画面が隠れている間・動きを減らす設定では止める）。
 */
export function Featured({ plots }: { plots: Plot[] }) {
  const rail = useRef<HTMLUListElement>(null);
  const [index, setIndex] = useState(0);
  const current = useRef(0);
  const pausedUntil = useRef(0);
  const hovering = useRef(false);

  // カードの左端の位置（先頭のカードを0とする）
  const offsets = useCallback(() => {
    const items = Array.from(rail.current?.children ?? []) as HTMLElement[];
    const base = items[0]?.offsetLeft ?? 0;
    return items.map((li) => li.offsetLeft - base);
  }, []);

  const go = useCallback(
    (i: number) => {
      const left = offsets()[i];
      if (left !== undefined) rail.current?.scrollTo({ left, behavior: "smooth" });
    },
    [offsets],
  );

  const pause = () => {
    pausedUntil.current = Date.now() + PAUSE_AFTER_TOUCH_MS;
  };

  useEffect(() => {
    if (plots.length < 2 || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => {
      if (document.hidden || hovering.current || Date.now() < pausedUntil.current) return;
      go((current.current + 1) % plots.length);
    }, INTERVAL_MS);
    return () => clearInterval(id);
  }, [go, plots.length]);

  const onScroll = () => {
    const x = rail.current?.scrollLeft ?? 0;
    const all = offsets();
    let best = 0;
    all.forEach((left, i) => {
      if (Math.abs(left - x) < Math.abs(all[best] - x)) best = i;
    });
    current.current = best;
    setIndex(best);
  };

  return (
    <section aria-label="注目作" aria-roledescription="カルーセル" className="mt-5">
      <ul
        ref={rail}
        onScroll={onScroll}
        onPointerDown={pause}
        onTouchStart={pause}
        onWheel={pause}
        onFocus={pause}
        onMouseEnter={() => (hovering.current = true)}
        onMouseLeave={() => (hovering.current = false)}
        className="rail relative flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-5 px-5 pb-2"
      >
        {plots.map((plot, i) => (
          <li key={plot.id} className="w-[84%] shrink-0 snap-start">
            <Link
              href={`/plot/${plot.id}`}
              data-featured
              className="press relative block aspect-[4/5] overflow-hidden rounded-3xl bg-night-2"
            >
              {plot.cover && (
                <Image
                  src={plot.cover}
                  alt=""
                  fill
                  sizes="(min-width: 576px) 484px, 84vw"
                  loading={i === 0 ? "eager" : "lazy"}
                  fetchPriority={i === 0 ? "high" : "auto"}
                  className="object-cover object-top"
                />
              )}
              <span aria-hidden className="absolute inset-x-0 bottom-0 h-[72%] bg-linear-to-t from-black via-black/75 to-transparent" />
              <NewBadge plot={plot} className="absolute left-4 top-4" />
              <div className="absolute inset-x-0 bottom-0 p-5">
                <div className="flex items-center gap-2.5">
                  <AvatarStack personas={plot.personas} size={34} />
                  <p className="truncate text-[0.8rem] font-bold">
                    {plot.personas.map((p, j) => (
                      <span key={p.name}>
                        {j > 0 && <span className="text-mist"> × </span>}
                        <span style={{ color: p.color }}>{callName(p)}</span>
                        {p.mbti && <span className="ml-1 text-[0.7rem] font-medium tracking-wide text-paper/60">{p.mbti}</span>}
                      </span>
                    ))}
                  </p>
                </div>
                <h2 className="break-phrase mt-2.5 text-balance text-[1.45rem] font-black leading-snug">{plot.title}</h2>
                <p className="break-phrase mt-1 line-clamp-2 text-[0.85rem] leading-6 text-paper/85">{plot.catchphrase}</p>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <p className="min-w-0 truncate text-[0.72rem] font-medium text-mist">
                    {plot.tags.map((t) => `#${t}`).join(" ")}
                  </p>
                  <span className="btn-brand shrink-0 rounded-full px-5 py-2 text-sm">はじめる</span>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      {plots.length > 1 && (
        <div className="mt-2 flex justify-center gap-1.5">
          {plots.map((plot, i) => (
            <button
              key={plot.id}
              aria-label={`${i + 1}番目の注目作：${plot.title}`}
              aria-current={i === index}
              onClick={() => {
                pause();
                go(i);
              }}
              className="grid h-4 place-items-center"
            >
              <span className={`block h-1.5 rounded-full transition-all duration-300 ${i === index ? "w-5 bg-paper" : "w-1.5 bg-paper/30"}`} />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
