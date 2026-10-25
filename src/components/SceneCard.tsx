"use client";

import { useEffect, useRef, useState } from "react";
import type { Plot, Viewpoint } from "@/lib/characters";
import { track } from "@/lib/client";
import { pickQuote } from "@/lib/story";

const W = 1080;
const H = 1350;
const MINCHO = '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif';
const GOTHIC = '"Hiragino Sans", "Noto Sans JP", "Yu Gothic UI", sans-serif';
// 行頭に来てはいけない文字（簡易の禁則処理）
const NO_START = "、。，．」』）！？ー…・～っゃゅょァィゥェォッャュョ";

/** 文字単位で折り返す。行頭禁則の文字は前の行に残す。 */
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const ch of text) {
    if (ch === "\n") {
      lines.push(line);
      line = "";
      continue;
    }
    if (ctx.measureText(line + ch).width > width && line && !NO_START.includes(ch)) {
      lines.push(line);
      line = ch;
    } else {
      line += ch;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function draw(canvas: HTMLCanvasElement, plot: Plot, quote: string) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.width = W;
  canvas.height = H;
  const tint = `hsl(${plot.hue} 70% 74%)`;

  ctx.fillStyle = "#1b1630";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = tint;
  ctx.fillRect(96, 140, 6, H - 380);

  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#a79bc0";
  ctx.font = `500 38px ${MINCHO}`;
  ctx.fillText(plot.title, 140, 180);
  ctx.font = `400 28px ${GOTHIC}`;
  ctx.fillText(plot.personas.map((p) => p.name).join("と"), 140, 232);

  ctx.fillStyle = "#f3eef8";
  ctx.font = `500 60px ${MINCHO}`;
  const lines = wrap(ctx, quote, W - 140 - 120).slice(0, 9);
  const lineH = 60 * 1.75;
  const top = 360 + Math.max(0, (9 - lines.length) * lineH) / 2;
  lines.forEach((l, i) => ctx.fillText(l, 140, top + i * lineH));

  ctx.fillStyle = tint;
  ctx.font = `600 44px ${MINCHO}`;
  ctx.fillText("yota", 140, H - 150);
  ctx.fillStyle = "#a79bc0";
  ctx.font = `400 28px ${GOTHIC}`;
  ctx.fillText("この物語の続きを、あなたも。", 140, H - 100);
}

export function SceneCard({
  plot,
  viewpoint,
  text,
  onClose,
}: {
  plot: Plot;
  viewpoint: Viewpoint;
  text: string;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const quote = pickQuote(text);

  useEffect(() => {
    track("card_open", { plotId: plot.id });
  }, [plot.id]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    draw(canvas, plot, quote);
    let objectUrl: string | null = null;
    canvas.toBlob((blob) => {
      if (!blob) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    }, "image/png");
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [plot, quote]);

  const link = `${window.location.origin}/chat/${plot.id}?v=${viewpoint}&ref=card`;
  const tweet = `${quote}\n\n『${plot.title}』で、続きはあなたが。\n#yota`;

  async function share() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
    if (!blob) return;
    const file = new File([blob], `yota-${plot.id}.png`, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text: tweet, url: link });
        track("card_share", { plotId: plot.id, via: "native" });
      } catch {
        // 共有シートを閉じただけ
      }
    } else {
      window.open(`https://x.com/intent/post?text=${encodeURIComponent(tweet)}&url=${encodeURIComponent(link)}`, "_blank", "noopener");
      track("card_share", { plotId: plot.id, via: "x_intent" });
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="名場面カード"
      className="fixed inset-0 z-50 flex items-end justify-center bg-night/85 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div className="w-full max-w-md rounded-t-2xl bg-night-2 p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <canvas ref={canvasRef} className="aspect-[4/5] w-full rounded-lg" aria-label={quote} />
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button onClick={share} className="rounded-full bg-paper py-3 text-sm font-semibold text-night">
            共有する
          </button>
          <a
            href={url ?? undefined}
            download={`yota-${plot.id}.png`}
            onClick={() => track("card_download", { plotId: plot.id })}
            className="rounded-full border border-line py-3 text-center text-sm text-paper"
          >
            画像を保存
          </a>
        </div>
        <button onClick={onClose} className="mt-3 w-full py-2 text-sm text-mist">
          閉じる
        </button>
      </div>
    </div>
  );
}
