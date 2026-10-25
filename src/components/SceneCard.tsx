"use client";

import { useEffect, useRef, useState } from "react";
import type { Plot, Viewpoint } from "@/lib/characters";
import { track } from "@/lib/client";
import { pickQuote } from "@/lib/story";

const W = 1080;
const H = 1350;
const MINCHO = '"Noto Sans JP", "Hiragino Sans", sans-serif';
const GOTHIC = MINCHO;
const NIGHT = "#0f0f13";
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

/** 2色を混ぜる（pct は a の割合） */
function mix(a: string, b: string, pct: number): string {
  const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const [x, y] = [hex(a), hex(b)];
  return `rgb(${x.map((v, i) => Math.round(v * pct + y[i] * (1 - pct))).join(",")})`;
}

function draw(canvas: HTMLCanvasElement, plot: Plot, quote: string, art?: HTMLImageElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.width = W;
  canvas.height = H;
  const [a, b] = plot.personas;
  const obiTop = H - 330;

  // 地：表紙と同じく、ひとりなら推し色、ふたりなら斜めに二色
  if (b) {
    ctx.fillStyle = mix(a.color, NIGHT, 0.5);
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = mix(b.color, NIGHT, 0.44);
    ctx.beginPath();
    ctx.moveTo(W, obiTop * 0.25);
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.lineTo(0, obiTop * 0.95);
    ctx.closePath();
    ctx.fill();
  } else {
    const g = ctx.createRadialGradient(W * 0.85, 0, 0, W * 0.85, 0, H);
    g.addColorStop(0, mix(a.color, NIGHT, 0.62));
    g.addColorStop(0.8, mix(a.color, NIGHT, 0.22));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  // 背表紙の折り目
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(0, 0, 22, H);
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.fillRect(22, 0, 3, H);

  // 表紙の絵があれば、上に敷いて下へ向かって沈める
  if (art) {
    const scale = Math.max(W / art.width, obiTop / art.height);
    const w = art.width * scale;
    const h = art.height * scale;
    ctx.drawImage(art, (W - w) / 2, 0, w, h);
    const g = ctx.createLinearGradient(0, 0, 0, obiTop);
    g.addColorStop(0, "rgba(29,24,56,0.05)");
    g.addColorStop(0.38, "rgba(29,24,56,0.2)");
    g.addColorStop(1, "rgba(29,24,56,0.94)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, obiTop);
  }

  // アイコン（絵がないとき）
  if (!art) plot.personas.forEach((p, i) => {
    const cx = 120 + i * 62;
    ctx.beginPath();
    ctx.arc(cx, 130, 44, 0, Math.PI * 2);
    ctx.fillStyle = NIGHT;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, 130, 38, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();
    ctx.fillStyle = NIGHT;
    ctx.font = `700 38px ${MINCHO}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(p.mark, cx, 132);
  });

  // 台詞
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#f7f3ff";
  ctx.font = `700 64px ${MINCHO}`;
  const lines = wrap(ctx, quote, W - 120 - 110).slice(0, 7);
  const lineH = 64 * 1.7;
  const areaTop = 250;
  const areaH = obiTop - areaTop - 40;
  // 絵があるときは顔にかからないよう、下に寄せる
  const top = art ? obiTop - 70 - (lines.length - 1) * lineH : areaTop + (areaH - lines.length * lineH) / 2 + 64;
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 18;
  lines.forEach((l, i) => ctx.fillText(l, 120, top + i * lineH));
  ctx.shadowBlur = 0;

  // 下の帯：アプリと同じダークに、ブランドのグラデーションの線
  ctx.fillStyle = NIGHT;
  ctx.fillRect(0, obiTop, W, H - obiTop);
  const brand = ctx.createLinearGradient(0, 0, W, 0);
  brand.addColorStop(0, "#ff4f9a");
  brand.addColorStop(0.55, "#c254f0");
  brand.addColorStop(1, "#8a5cff");
  ctx.fillStyle = brand;
  ctx.fillRect(0, obiTop, W, 8);
  ctx.fillStyle = "#f5f5f7";
  ctx.font = `900 52px ${MINCHO}`;
  ctx.fillText(plot.title, 96, obiTop + 110);
  ctx.fillStyle = a.color;
  ctx.font = `700 30px ${GOTHIC}`;
  ctx.fillText(plot.personas.map((p) => p.name).join(" × "), 96, obiTop + 166);
  ctx.fillStyle = "#a3a3ae";
  ctx.font = `500 30px ${GOTHIC}`;
  ctx.fillText("この続きは、あなたが書く。", 96, H - 72);
  ctx.textAlign = "right";
  ctx.fillStyle = brand;
  ctx.font = `900 60px ${MINCHO}`;
  ctx.fillText("yota", W - 90, H - 68);
}

function loadImage(src: string): Promise<HTMLImageElement | undefined> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(undefined);
    img.src = src;
  });
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
    // 書体を読み込んでから描く（読み込み前だと代わりの書体で描かれてしまう）
    const sample = quote + plot.title + plot.personas.map((p) => p.name + p.mark).join("") + "この続きはあなたが書く。yota『』×";
    const art = plot.cover ? loadImage(plot.cover) : Promise.resolve(undefined);
    void Promise.all([
      document.fonts.load(`700 64px ${MINCHO}`, sample),
      document.fonts.load(`500 30px ${GOTHIC}`, sample),
      document.fonts.load(`900 52px ${MINCHO}`, sample),
    ])
      .catch(() => undefined)
      .then(() => art)
      .then((img) => {
        if (!alive) return;
        draw(canvas, plot, quote, img);
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
        <span aria-hidden className="mx-auto mb-3 block h-1 w-10 rounded-full bg-line" />
        <canvas ref={canvasRef} className="aspect-[4/5] w-full rounded-md shadow-[0_14px_30px_-14px_rgba(0,0,0,0.8)]" aria-label={quote} />
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button onClick={share} className="btn-brand press rounded-2xl py-3.5 text-sm">
            共有する
          </button>
          <a
            href={url ?? undefined}
            download={`yota-${plot.id}.png`}
            onClick={() => track("card_download", { plotId: plot.id })}
            className="press rounded-2xl bg-night-3 py-3.5 text-center text-sm font-bold text-paper"
          >
            画像を保存
          </a>
        </div>
        <button onClick={onClose} className="press mt-2 w-full py-2.5 text-sm text-mist">
          閉じる
        </button>
      </div>
    </div>
  );
}
