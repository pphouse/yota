"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * 記事を読み進めると、画面の下に出る「無料で遊ぶ」の帯。
 * 押したくなった瞬間に、いつでも押せるようにする。
 * 冒頭（絵のあたり）を読んでいるあいだと、記事の最後のボタン（#cta-end）が見えているあいだは隠す。
 */
export function CtaBar({ href, label }: { href: string; label: string }) {
  const [scrolled, setScrolled] = useState(false);
  const [endVisible, setEndVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 600);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    const end = document.getElementById("cta-end");
    const io = end ? new IntersectionObserver(([e]) => setEndVisible(e.isIntersecting)) : null;
    if (end && io) io.observe(end);
    return () => {
      window.removeEventListener("scroll", onScroll);
      io?.disconnect();
    };
  }, []);

  const show = scrolled && !endVisible;
  return (
    <div
      className="cta-bar fixed inset-x-0 bottom-0 z-30 border-t border-black/5 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl"
      data-show={show}
      aria-hidden={!show}
    >
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-192.png" alt="" width={40} height={40} className="shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-[0.85rem] font-black text-ink">yota（ヨタ）</p>
          <p className="truncate text-[0.7rem] text-ink-3">無料・広告なし・登録なしで開始</p>
        </div>
        <Link
          href={href}
          tabIndex={show ? 0 : -1}
          className="cta-btn shrink-0 rounded-full bg-[image:var(--brand-grad)] px-5 py-2.5 text-[0.85rem] font-black text-white shadow-md shadow-fuchsia-500/20"
        >
          {label.length > 10 ? "無料で遊ぶ" : label}
          <span className="cta-arrow" aria-hidden>
            →
          </span>
        </Link>
      </div>
    </div>
  );
}
