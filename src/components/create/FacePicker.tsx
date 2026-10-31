"use client";

import { useRef, useState } from "react";
import { ImageIcon } from "@/components/icons";

const SIZE = 512;

/** 選んだ画像を正方形に切り抜いて縮める。縦長の絵は、顔が入りやすいよう上寄りで切る */
async function toSquare(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const s = Math.min(bmp.width, bmp.height);
  const x = (bmp.width - s) / 2;
  const y = bmp.height > bmp.width ? (bmp.height - s) * 0.2 : (bmp.height - s) / 2;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bmp, x, y, s, s, 0, 0, SIZE, SIZE);
  bmp.close();
  const encode = (type: string, q: number) => new Promise<Blob | null>((r) => canvas.toBlob(r, type, q));
  const webp = await encode("image/webp", 0.86);
  // WebP に書き出せないブラウザでは JPEG にする
  if (webp && webp.type === "image/webp") return webp;
  const jpeg = await encode("image/jpeg", 0.88);
  if (!jpeg) throw new Error("画像を読めませんでした");
  return jpeg;
}

/** キャラの画像を登録する丸いボタン。登録すると、アイコンと文字のジャケットに使う */
export function FacePicker({ id, face, color, onChange }: { id: string; face?: string; color: string; onChange: (url: string | undefined) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const blob = await toSquare(file);
      const res = await fetch("/api/ugc/images", { method: "POST", headers: { "content-type": blob.type }, body: blob });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? "登録できませんでした");
      onChange(data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "登録できませんでした");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="flex shrink-0 flex-col items-center gap-1">
      <button
        id={id}
        type="button"
        onClick={() => input.current?.click()}
        disabled={busy}
        aria-label={face ? "画像を変える" : "画像を登録する"}
        className="press relative grid size-[4.5rem] place-items-center overflow-hidden rounded-full bg-night-3 text-mist"
        style={{ border: `2px solid ${color}` }}
      >
        {face ? (
          // 登録した画像は小さい正方形なので、そのまま出す
          // eslint-disable-next-line @next/next/no-img-element
          <img src={face} alt="" className="size-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-0.5 text-[0.62rem] font-bold">
            <ImageIcon size={20} />
            {busy ? "登録中" : "画像"}
          </span>
        )}
        {busy && face && <span className="absolute inset-0 grid place-items-center bg-black/50 text-[0.62rem] font-bold text-white">登録中</span>}
      </button>
      {face && (
        <button type="button" onClick={() => onChange(undefined)} className="press text-[0.65rem] font-bold text-mist hover:text-paper">
          外す
        </button>
      )}
      {error && <p className="max-w-[6rem] text-center text-[0.62rem] leading-4 text-amber">{error}</p>}
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => pick(e.target.files?.[0])} />
    </div>
  );
}
