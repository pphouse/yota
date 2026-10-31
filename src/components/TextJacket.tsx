import type { Plot } from "@/lib/characters";

/**
 * 絵のジャケットがない作品（ユーザーが作った作品で、絵を作っている途中・作れなかったとき）の、文字だけのジャケット。
 * 推し色のグラデーションに、タイトルを大きく縦に組む
 */
export function TextJacket({ plot, generating = false }: { plot: Plot; generating?: boolean }) {
  const [a, b] = [plot.personas[0]?.color ?? "#c3a6ff", plot.personas[1]?.color ?? "#ff8fb1"];
  return (
    <div
      className="absolute inset-0 flex flex-col justify-between overflow-hidden p-[8%]"
      style={{ background: `linear-gradient(160deg, ${a}cc 0%, #1b1530 55%, ${b}aa 100%)` }}
    >
      <p className="text-[clamp(0.55rem,2.2vw,0.75rem)] font-bold tracking-widest text-white/80">{plot.tags.slice(0, 3).map((t) => `#${t}`).join(" ")}</p>
      <p className="break-phrase self-end text-right text-[clamp(1.1rem,6vw,2.1rem)] font-black leading-tight text-white [text-shadow:0_2px_12px_rgba(0,0,0,.45)] [writing-mode:vertical-rl]">
        {plot.title}
      </p>
      <p className="text-[clamp(0.55rem,2.2vw,0.75rem)] font-bold text-white/85">
        {generating ? "ジャケットを作っています…" : plot.personas.map((p) => p.name).join(" × ")}
      </p>
    </div>
  );
}
