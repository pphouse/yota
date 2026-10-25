"use client";

import { useEffect, useRef, useState } from "react";
import type { Plot, Viewpoint } from "@/lib/characters";
import { track } from "@/lib/client";
import { pickQuote } from "@/lib/story";

const W = 1080;
const H = 1350;
const BAND = 310;
const GOTHIC = '"Noto Sans JP", "Hiragino Sans", "Hiragino Kaku Gothic ProN", sans-serif';
const NIGHT = "#0f0f13";
const PAPER = "#f5f5f7";
const MIST = "#a3a3ae";
const TAGLINE = "この続きは、あなたが書く。";
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

/** ブランドのグラデーション（ピンク→紫）を x0〜x1 に敷く */
function brand(ctx: CanvasRenderingContext2D, x0: number, x1: number): CanvasGradient {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, "#ff4f9a");
  g.addColorStop(0.55, "#c254f0");
  g.addColorStop(1, "#8a5cff");
  return g;
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function draw(canvas: HTMLCanvasElement, plot: Plot, quote: string, cover: HTMLImageElement | null) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.width = W;
  canvas.height = H;
  const bandTop = H - BAND;
  ctx.fillStyle = NIGHT;
  ctx.fillRect(0, 0, W, H);

  // 上部：表紙の絵を上合わせで敷く（絵がなければ推し色をほのかに）
  if (cover) {
    const scale = Math.max(W / cover.width, bandTop / cover.height);
    const dw = cover.width * scale;
    ctx.drawImage(cover, (W - dw) / 2, 0, dw, cover.height * scale);
  } else {
    const g = ctx.createRadialGradient(W * 0.8, 0, 0, W * 0.8, 0, bandTop);
    g.addColorStop(0, plot.personas[0].color);
    g.addColorStop(1, NIGHT);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, bandTop);
  }
  // 下へ暗くして、台詞を読めるようにする
  const shade = ctx.createLinearGradient(0, bandTop * 0.28, 0, bandTop);
  shade.addColorStop(0, "rgba(15,15,19,0)");
  shade.addColorStop(0.5, "rgba(15,15,19,0.74)");
  shade.addColorStop(1, "rgba(15,15,19,0.98)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, W, bandTop);

  // 台詞（下寄せ）
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = PAPER;
  ctx.font = `700 58px ${GOTHIC}`;
  const lines = wrap(ctx, quote, W - 88 * 2).slice(0, 6);
  const lineH = 58 * 1.62;
  const bottom = bandTop - 70;
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = 20;
  lines.forEach((l, i) => ctx.fillText(l, 88, bottom - (lines.length - 1 - i) * lineH));
  ctx.shadowBlur = 0;

  // 下の帯：ブランドの線、タイトル、推し色の名前、yota
  ctx.fillStyle = NIGHT;
  ctx.fillRect(0, bandTop, W, BAND);
  ctx.fillStyle = brand(ctx, 0, W);
  ctx.fillRect(0, bandTop, W, 6);

  ctx.fillStyle = PAPER;
  ctx.font = `900 50px ${GOTHIC}`;
  ctx.fillText(plot.title, 88, bandTop + 100, W - 88 * 2);

  ctx.font = `700 32px ${GOTHIC}`;
  let x = 88;
  plot.personas.forEach((p, i) => {
    if (i > 0) {
      ctx.fillStyle = MIST;
      ctx.fillText(" × ", x, bandTop + 160);
      x += ctx.measureText(" × ").width;
    }
    ctx.fillStyle = p.color;
    ctx.fillText(p.name, x, bandTop + 160);
    x += ctx.measureText(p.name).width;
  });

  ctx.fillStyle = MIST;
  ctx.font = `500 28px ${GOTHIC}`;
  ctx.fillText(TAGLINE, 88, H - 62);
  ctx.textAlign = "right";
  ctx.font = `900 72px ${GOTHIC}`;
  const logo = ctx.measureText("yota").width;
  ctx.fillStyle = brand(ctx, W - 84 - logo, W - 84);
  ctx.fillText("yota", W - 84, H - 56);
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
    let objectUrl: string | null = null;
    let alive = true;
    // 書体（900を含む）と表紙の絵を読み込んでから描く（読み込み前だと代わりの書体や空の絵で描かれてしまう）
    const sample = quote + plot.title + plot.personas.map((p) => p.name).join("") + TAGLINE + "yota ×";
    void Promise.all([
      Promise.all([
        document.fonts.load(`700 58px ${GOTHIC}`, sample),
        document.fonts.load(`900 50px ${GOTHIC}`, sample),
        document.fonts.load(`500 28px ${GOTHIC}`, sample),
      ]).catch(() => undefined),
      plot.cover ? loadImage(plot.cover) : Promise.resolve(null),
    ]).then(([, cover]) => {
      if (!alive) return;
      draw(canvas, plot, quote, cover);
      canvas.toBlob((blob) => {
        if (!blob || !alive) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      }, "image/png");
    });
    return () => {
      alive = false;
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
      <div
        className="arrive w-full max-w-md rounded-t-[1.6rem] bg-night-2 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:rounded-[1.6rem]"
        onClick={(e) => e.stopPropagation()}
      >
        <span aria-hidden className="mx-auto mb-3 block h-1 w-10 rounded-full bg-night-3" />
        <canvas
          ref={canvasRef}
          data-ready={url ? "" : undefined}
          className="aspect-[4/5] w-full rounded-2xl bg-night-3 shadow-[0_14px_30px_-14px_rgba(0,0,0,0.8)]"
          aria-label={quote}
        />
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button onClick={share} className="press btn-brand rounded-full py-3.5 text-sm">
            共有する
          </button>
          <a
            href={url ?? undefined}
            download={`yota-${plot.id}.png`}
            onClick={() => track("card_download", { plotId: plot.id })}
            className="press rounded-full bg-night-3 py-3.5 text-center text-sm font-bold text-paper"
          >
            画像を保存
          </a>
        </div>
        <button onClick={onClose} className="press mt-2 w-full py-2.5 text-sm font-bold text-mist">
          閉じる
        </button>
      </div>
    </div>
  );
}
