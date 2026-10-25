import type { Persona } from "@/lib/characters";

/** キャラのアイコン。立ち絵の代わりに、推し色の丸に一文字。 */
export function Avatar({ persona, size = 32, ring = false }: { persona: Persona; size?: number; ring?: boolean }) {
  return (
    <span
      aria-hidden
      className={`grid shrink-0 select-none place-items-center rounded-full font-mincho font-bold leading-none text-night ${
        ring ? "ring-2 ring-night" : ""
      }`}
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
