"use client";

import { track, type TrackType } from "@/lib/client";

/** X の投稿画面の URL（文章とリンクを入れた状態で開く） */
export function xIntentUrl(text: string, url: string): string {
  return `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
}

export function XLogo({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

/**
 * X でシェアするボタン。新しい窓で X の投稿画面を開く（アプリの中では、X のアプリか端末のブラウザが開く）。
 * url を渡さなければ、押したときのページの URL を使う。
 */
export function XShareButton({
  text,
  url,
  label = "Xでシェア",
  event,
  className = "",
}: {
  text: string;
  url?: string;
  label?: string;
  event?: { name: TrackType; props?: Record<string, string | number | boolean | null> };
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        const link = url ?? window.location.href.split("?")[0];
        window.open(xIntentUrl(text, link), "_blank", "noopener,noreferrer");
        if (event) track(event.name, { ...event.props, via: "x_intent" });
      }}
      className={`press flex items-center justify-center gap-2 rounded-2xl bg-black py-3 text-sm font-bold text-white ring-1 ring-white/15 ${className}`}
    >
      <XLogo />
      {label}
    </button>
  );
}
