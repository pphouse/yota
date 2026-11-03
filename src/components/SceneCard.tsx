"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Plot, Viewpoint } from "@/lib/characters";
import { LOGO_MOON, LOGO_TBAR, LOGO_VIEWBOX, LOGO_WORD } from "@/components/Logo";
import { track } from "@/lib/client";
import { mangaPanels, pickQuote, type MangaPanels } from "@/lib/story";
import { isNativeApp, shareImageNative } from "@/lib/native";

const W = 1080;
const H = 1350;
const BAND = 230;
const GOTHIC = '"Noto Sans JP", "Hiragino Sans", "Hiragino Kaku Gothic ProN", sans-serif';
const NIGHT = "#0f0f13";
const PAPER = "#f5f5f7";
const MIST = "#a3a3ae";
const INK = "#111114";
const SHEET = "#f6f3ec";
// 行頭に来てはいけない文字（簡易の禁則処理）
const NO_START = "、。，．」』）！？ー…・～っゃゅょァィゥェォッャュョ";
// 縦書きで90度回す文字と、右上に寄せる句読点
const ROTATE = "ー－―〜～…‥「」『』（）()[]【】<>＜＞=＝";
const CORNER = "、。，．";

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

type Pt = [number, number];

function polygon(ctx: CanvasRenderingContext2D, pts: Pt[]) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}

/** 枠の中に、絵を覆うように敷く（fx, fy は絵のどこを中心にするか、zoom は寄り） */
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, box: { x: number; y: number; w: number; h: number }, fx = 0.5, fy = 0.3, zoom = 1) {
  const scale = Math.max(box.w / img.width, box.h / img.height) * zoom;
  const dw = img.width * scale;
  const dh = img.height * scale;
  const dx = Math.min(box.x, Math.max(box.x + box.w - dw, box.x + box.w / 2 - dw * fx));
  const dy = Math.min(box.y, Math.max(box.y + box.h - dh, box.y + box.h / 2 - dh * fy));
  ctx.drawImage(img, dx, dy, dw, dh);
}

/** 漫画のトーン（網点）。推し色をうすく敷き、黒い点を並べる */
function screentone(ctx: CanvasRenderingContext2D, box: { x: number; y: number; w: number; h: number }, color: string) {
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.28;
  ctx.fillRect(box.x, box.y, box.w, box.h);
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = INK;
  for (let y = box.y; y < box.y + box.h; y += 14) {
    for (let x = box.x + ((y / 14) % 2 ? 7 : 0); x < box.x + box.w; x += 14) {
      ctx.beginPath();
      ctx.arc(x, y, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

/** 集中線 */
function speedLines(ctx: CanvasRenderingContext2D, cx: number, cy: number, r0: number, r1: number) {
  ctx.strokeStyle = INK;
  for (let i = 0; i < 90; i++) {
    const a = (i / 90) * Math.PI * 2 + (i % 3) * 0.013;
    const inner = r0 * (0.85 + ((i * 37) % 10) / 30);
    ctx.lineWidth = 1 + ((i * 13) % 4);
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
    ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/** 縦書きの列に分ける（行頭禁則の文字は前の列に残す） */
function columns(text: string, rows: number): string[] {
  const cols: string[] = [];
  let col = "";
  for (const ch of Array.from(text.replace(/\s+/g, ""))) {
    if (Array.from(col).length >= rows && !NO_START.includes(ch)) {
      cols.push(col);
      col = ch;
    } else col += ch;
  }
  if (col) cols.push(col);
  return cols;
}

/** 縦書きで描く。右上 (xRight, yTop) から、列を右から左へ */
function drawVertical(ctx: CanvasRenderingContext2D, cols: string[], xRight: number, yTop: number, size: number) {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const colW = size * 1.32;
  const rowH = size * 1.06;
  cols.forEach((col, i) => {
    const cx = xRight - colW * i - colW / 2;
    Array.from(col).forEach((ch, j) => {
      const cy = yTop + rowH * j + rowH / 2;
      if (ROTATE.includes(ch)) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(Math.PI / 2);
        ctx.fillText(ch, 0, 0);
        ctx.restore();
      } else if (CORNER.includes(ch)) {
        ctx.fillText(ch, cx + size * 0.55, cy - size * 0.5);
      } else {
        ctx.fillText(ch, cx, cy);
      }
    });
  });
}

/** 縦書きの文が入る大きさ */
function verticalSize(cols: string[], size: number) {
  return { w: cols.length * size * 1.32, h: Math.max(...cols.map((c) => Array.from(c).length)) * size * 1.06 };
}

/** 吹き出し（楕円としっぽ）。thought なら考えごとの雲の形（小さな丸の連なり） */
function bubble(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, tail: Pt, thought = false) {
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5;
  if (thought) {
    // 雲：楕円のまわりに丸を並べる
    ctx.beginPath();
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      ctx.moveTo(cx + Math.cos(a) * rx + rx * 0.18, cy + Math.sin(a) * ry);
      ctx.arc(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, rx * 0.18, 0, Math.PI * 2);
    }
    ctx.stroke();
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    // しっぽ：雲の外側から、小さな丸を3つ（文字に重ならないよう、楕円のふちの外から並べる）
    const a = Math.atan2(tail[1] - cy, tail[0] - cx);
    const edge = 1 / Math.sqrt((Math.cos(a) / rx) ** 2 + (Math.sin(a) / ry) ** 2) + rx * 0.2;
    [28, 62, 90].forEach((d, i) => {
      const x = cx + Math.cos(a) * (edge + d);
      const y = cy + Math.sin(a) * (edge + d);
      ctx.beginPath();
      ctx.arc(x, y, 15 - i * 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
    return;
  }
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // しっぽ
  const a = Math.atan2(tail[1] - cy, tail[0] - cx);
  const base = (d: number): Pt => [cx + Math.cos(a + d) * rx * 0.92, cy + Math.sin(a + d) * ry * 0.92];
  ctx.beginPath();
  ctx.moveTo(...base(-0.16));
  ctx.lineTo(...tail);
  ctx.lineTo(...base(0.16));
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // 楕円との境目の線を消す
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx - 4, ry - 4, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** 縦書きの文を吹き出しに入れて描く */
function speech(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number, tail: Pt, opts: { size: number; rows: number; thought?: boolean }) {
  const cols = columns(text, opts.rows);
  const { w, h } = verticalSize(cols, opts.size);
  bubble(ctx, cx, cy, w / 2 + opts.size * 1.3, h / 2 + opts.size * 1.2, tail, opts.thought);
  ctx.fillStyle = INK;
  ctx.font = `700 ${opts.size}px ${GOTHIC}`;
  drawVertical(ctx, cols, cx + w / 2, cy - h / 2, opts.size);
}

export type CardImages = { cover: HTMLImageElement | null; faces: (HTMLImageElement | null)[] };

/** 漫画のコマ風の名場面カード。右上から読む3コマ：①情景とナレーション ②寄りの絵と台詞 ③心の声（なければもう1つの台詞） */
function draw(canvas: HTMLCanvasElement, plot: Plot, panels: MangaPanels, images: CardImages) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.width = W;
  canvas.height = H;
  const M = 36;
  const G = 18;
  const pageBottom = H - BAND;
  ctx.fillStyle = SHEET;
  ctx.fillRect(0, 0, W, pageBottom);
  const color = plot.personas[(panels.line?.speaker ?? 0) % plot.personas.length]?.color ?? "#c3a6ff";
  const faceOf = (speaker?: number) => images.faces[speaker ?? 0] ?? images.faces.find(Boolean) ?? null;

  // ① 上の横長のコマ：作品の絵と、ナレーションの箱（右上・縦書き）
  const p1 = { x: M, y: M, w: W - M * 2, h: 380 };
  ctx.save();
  polygon(ctx, [
    [p1.x, p1.y],
    [p1.x + p1.w, p1.y],
    [p1.x + p1.w, p1.y + p1.h],
    [p1.x, p1.y + p1.h],
  ]);
  ctx.clip();
  if (images.cover) drawCover(ctx, images.cover, p1, 0.5, 0.35, 1);
  else screentone(ctx, p1, color);
  ctx.restore();
  ctx.lineWidth = 6;
  ctx.strokeStyle = INK;
  ctx.strokeRect(p1.x, p1.y, p1.w, p1.h);
  if (panels.narration) {
    const size = 34;
    const cols = columns(panels.narration, 8);
    const { w, h } = verticalSize(cols, size);
    const bx = p1.x + p1.w - w - 40;
    const by = p1.y + 22;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(bx - 16, by - 12, w + 32, h + 24);
    ctx.lineWidth = 4;
    ctx.strokeRect(bx - 16, by - 12, w + 32, h + 24);
    ctx.fillStyle = INK;
    ctx.font = `700 ${size}px ${GOTHIC}`;
    drawVertical(ctx, cols, bx + w, by, size);
  }

  // ② と ③：斜めに分けた下のコマ（右が②、左が③）
  const top = p1.y + p1.h + G;
  const bottom = pageBottom - M;
  const splitTop = W * 0.5;
  const splitBottom = W * 0.4;
  const right: Pt[] = [
    [splitTop + G / 2, top],
    [W - M, top],
    [W - M, bottom],
    [splitBottom + G / 2, bottom],
  ];
  const left: Pt[] = [
    [M, top],
    [splitTop - G / 2, top],
    [splitBottom - G / 2, bottom],
    [M, bottom],
  ];

  // ② 寄りの絵（話している人の顔、なければ作品の絵に寄る）と台詞の吹き出し
  ctx.save();
  polygon(ctx, right);
  ctx.clip();
  const box2 = { x: splitBottom, y: top, w: W - M - splitBottom, h: bottom - top };
  const face = faceOf(panels.line?.speaker);
  if (face) drawCover(ctx, face, box2, 0.5, 0.4, 1);
  else if (images.cover) drawCover(ctx, images.cover, box2, 0.5, 0.3, 1.9);
  else screentone(ctx, box2, color);
  ctx.restore();
  polygon(ctx, right);
  ctx.lineWidth = 6;
  ctx.strokeStyle = INK;
  ctx.stroke();
  if (panels.line) speech(ctx, panels.line.text, splitTop + 150, top + 230, [splitTop + 250, top + 420], { size: 40, rows: 9 });

  // ③ 心の声（雲の吹き出し）か、もう1つの台詞。トーンと集中線
  ctx.save();
  polygon(ctx, left);
  ctx.clip();
  const box3 = { x: M, y: top, w: splitTop - M, h: bottom - top };
  screentone(ctx, box3, plot.personas[(panels.inner?.speaker ?? panels.second?.speaker ?? 0) % plot.personas.length]?.color ?? color);
  speedLines(ctx, M + box3.w * 0.48, top + box3.h * 0.5, 190, 520);
  ctx.restore();
  polygon(ctx, left);
  ctx.lineWidth = 6;
  ctx.stroke();
  const third = panels.inner ?? panels.second;
  if (third) {
    const cx = M + (splitBottom - M) * 0.55;
    const cy = top + (bottom - top) * 0.5;
    speech(ctx, third.text, cx, cy, [cx + 60, bottom - 40], { size: 36, rows: 8, thought: Boolean(panels.inner) });
    if (panels.inner) {
      ctx.fillStyle = INK;
      ctx.font = `900 26px ${GOTHIC}`;
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillText("心の声", M + 22, top + 44);
    }
  }

  // 下の帯：ブランドの線、タイトル、推し色の名前、yota
  const bandTop = pageBottom;
  ctx.fillStyle = NIGHT;
  ctx.fillRect(0, bandTop, W, BAND);
  ctx.fillStyle = brand(ctx, 0, W);
  ctx.fillRect(0, bandTop, W, 6);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = PAPER;
  ctx.font = `900 48px ${GOTHIC}`;
  ctx.fillText(plot.title, 72, bandTop + 92, W - 72 * 2);
  ctx.font = `700 30px ${GOTHIC}`;
  let x = 72;
  plot.personas.forEach((p, i) => {
    if (i > 0) {
      ctx.fillStyle = MIST;
      ctx.fillText(" × ", x, bandTop + 148);
      x += ctx.measureText(" × ").width;
    }
    ctx.fillStyle = p.color;
    ctx.fillText(p.name, x, bandTop + 148);
    x += ctx.measureText(p.name).width;
  });
  const k = 60 / LOGO_VIEWBOX.h;
  ctx.save();
  ctx.translate(W - 72 - LOGO_VIEWBOX.w * k, H - 46 - LOGO_VIEWBOX.h * k);
  ctx.scale(k, k);
  ctx.fillStyle = PAPER;
  ctx.fill(new Path2D(LOGO_WORD));
  ctx.fill(new Path2D(LOGO_TBAR));
  ctx.fillStyle = brand(ctx, LOGO_VIEWBOX.w * 0.75, LOGO_VIEWBOX.w);
  ctx.fill(new Path2D(LOGO_MOON));
  ctx.restore();
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
  // アプリの中では「画像を保存」は共有シートから選ぶので、ボタンを1つにする（開いてから出す部品なので、最初から判定してよい）
  const [native] = useState(() => isNativeApp());
  const quote = pickQuote(text);
  const panels = useMemo(() => mangaPanels(text, plot.personas.map((p) => p.name)), [text, plot.personas]);

  useEffect(() => {
    track("card_open", { plotId: plot.id });
  }, [plot.id]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let objectUrl: string | null = null;
    let alive = true;
    // 書体（900を含む）と絵を読み込んでから描く（読み込み前だと代わりの書体や空の絵で描かれてしまう）
    const sample = [panels.narration, panels.line?.text, panels.inner?.text, panels.second?.text, plot.title, ...plot.personas.map((p) => p.name), " × 心の声"].join("");
    const cover = plot.cover ?? plot.backdrop ?? plot.jacket;
    void Promise.all([
      Promise.all([document.fonts.load(`700 40px ${GOTHIC}`, sample), document.fonts.load(`900 48px ${GOTHIC}`, sample)]).catch(() => undefined),
      cover ? loadImage(cover) : Promise.resolve(null),
      Promise.all(plot.personas.map((p) => (p.face ? loadImage(p.face) : Promise.resolve(null)))),
    ]).then(([, coverImg, faces]) => {
      if (!alive) return;
      draw(canvas, plot, panels, { cover: coverImg, faces });
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
  }, [plot, panels]);

  const link = `${window.location.origin}/chat/${plot.id}?v=${viewpoint}&ref=card`;
  const tweet = `${quote}\n\n『${plot.title}』より\n#yota`;

  async function share() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
    if (!blob) return;
    if (isNativeApp()) {
      // アプリの中：端末の共有シート（「画像を保存」もここから選べる）
      if (await shareImageNative(blob, `yota-${plot.id}.png`, `${tweet}\n${link}`)) track("card_share", { plotId: plot.id, via: "app" });
      return;
    }
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
        <div className={`mt-4 grid gap-3 ${native ? "grid-cols-1" : "grid-cols-2"}`}>
          <button onClick={share} className="press btn-brand rounded-full py-3.5 text-sm">
            共有する
          </button>
          <a
            hidden={native}
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
