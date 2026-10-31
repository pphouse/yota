import Image from "next/image";
import type { Persona } from "@/lib/characters";

/** キャラのアイコン。顔の絵を丸く切り、推し色の縁をつける。絵がなければ推し色の丸に一文字。 */
export function Avatar({ persona, size = 32, ring = false }: { persona: Persona; size?: number; ring?: boolean }) {
  const outline = ring ? "ring-2 ring-night" : "";
  if (persona.face) {
    return (
      <Image
        src={persona.face}
        alt=""
        aria-hidden
        width={size}
        height={size}
        draggable={false}
        // ユーザーが登録した画像は、そのまま出す（最適化の対象外）
        unoptimized={persona.face.startsWith("/api/")}
        className={`block shrink-0 select-none rounded-full bg-night-3 object-cover ${outline}`}
        style={{ width: size, height: size, border: `2px solid ${persona.color}` }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={`grid shrink-0 select-none place-items-center rounded-full font-bold leading-none text-night ${outline}`}
      style={{ width: size, height: size, background: persona.color, fontSize: Math.round(size * 0.48) }}
    >
      {persona.mark}
    </span>
  );
}

export function AvatarStack({ personas, size = 32 }: { personas: Persona[]; size?: number }) {
  return (
    <span className="flex shrink-0">
      {personas.map((p, i) => (
        <span key={p.name} style={{ marginLeft: i ? -size * 0.3 : 0 }}>
          <Avatar persona={p} size={size} ring={personas.length > 1} />
        </span>
      ))}
    </span>
  );
}
