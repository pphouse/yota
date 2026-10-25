import Image from "next/image";
import type { Persona } from "@/lib/characters";

/** キャラのアイコン。顔の絵があれば推し色の縁どりで、なければ推し色の丸に一文字。 */
export function Avatar({ persona, size = 32, ring = false }: { persona: Persona; size?: number; ring?: boolean }) {
  const shadow = ring ? `0 0 0 2px ${persona.color}, 0 0 0 4px var(--night)` : `0 0 0 2px ${persona.color}`;
  if (persona.face) {
    return (
      <span
        aria-hidden
        className="relative block shrink-0 overflow-hidden rounded-full bg-night-2"
        style={{ width: size, height: size, boxShadow: shadow }}
      >
        <Image src={persona.face} alt="" fill sizes={`${size * 2}px`} className="object-cover" />
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className="grid shrink-0 select-none place-items-center rounded-full font-mincho font-bold leading-none text-night"
      style={{ width: size, height: size, background: persona.color, fontSize: Math.round(size * 0.48), boxShadow: ring ? "0 0 0 2px var(--night)" : undefined }}
    >
      {persona.mark}
    </span>
  );
}

export function AvatarStack({ personas, size = 32 }: { personas: Persona[]; size?: number }) {
  return (
    <span className="flex shrink-0">
      {personas.map((p, i) => (
        <span key={p.name} className="relative" style={{ marginLeft: i ? -size * 0.28 : 0, zIndex: personas.length - i }}>
          <Avatar persona={p} size={size} ring={personas.length > 1} />
        </span>
      ))}
    </span>
  );
}
