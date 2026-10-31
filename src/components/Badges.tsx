"use client";

import { isNew, type Persona, type Plot } from "@/lib/characters";
import { useNow } from "@/lib/useNow";

/** 公開後に追加して間もない作品に付ける NEW */
export function NewBadge({ plot, className = "" }: { plot: Plot; className?: string }) {
  const now = useNow();
  if (now === null || !isNew(plot, now)) return null;
  return <span className={`rounded-full bg-brand-grad px-2 py-0.5 text-[0.66rem] font-black tracking-wider text-white shadow ${className}`}>NEW</span>;
}

/** 登場人物の MBTI（ふたりなら「ISTJ×ESTP」） */
export function MbtiChip({ personas, className = "" }: { personas: Persona[]; className?: string }) {
  const types = personas.map((p) => p.mbti).filter(Boolean);
  if (types.length === 0) return null;
  return (
    <span className={`rounded-full bg-black/55 px-2 py-0.5 text-[0.66rem] font-bold tracking-wider text-paper/90 backdrop-blur-sm ${className}`}>
      {types.join("×")}
    </span>
  );
}
