import Image from "next/image";
import Link from "next/link";
import { AvatarStack } from "@/components/Avatar";
import { callName, type Plot } from "@/lib/characters";

/** 注目作。横にすべらせる大きなカード。絵の下側を暗くして、その上に作品の情報を載せる。 */
export function Featured({ plots }: { plots: Plot[] }) {
  return (
    <section aria-label="注目作" className="mt-5">
      <ul className="rail flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-5 px-5 pb-2">
        {plots.map((plot, i) => (
          <li key={plot.id} className="w-[84%] shrink-0 snap-start">
            <Link
              href={`/plot/${plot.id}`}
              data-featured
              className="press relative block aspect-[4/5] overflow-hidden rounded-3xl bg-night-2"
            >
              {plot.cover && (
                <Image
                  src={plot.cover}
                  alt=""
                  fill
                  sizes="(min-width: 576px) 484px, 84vw"
                  loading={i === 0 ? "eager" : "lazy"}
                  fetchPriority={i === 0 ? "high" : "auto"}
                  className="object-cover object-top"
                />
              )}
              <span aria-hidden className="absolute inset-x-0 bottom-0 h-[72%] bg-linear-to-t from-black via-black/75 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5">
                <div className="flex items-center gap-2.5">
                  <AvatarStack personas={plot.personas} size={34} />
                  <p className="truncate text-[0.8rem] font-bold">
                    {plot.personas.map((p, j) => (
                      <span key={p.name}>
                        {j > 0 && <span className="text-mist"> × </span>}
                        <span style={{ color: p.color }}>{callName(p)}</span>
                      </span>
                    ))}
                  </p>
                </div>
                <h2 className="break-phrase mt-2.5 text-balance text-[1.45rem] font-black leading-snug">{plot.title}</h2>
                <p className="break-phrase mt-1 line-clamp-2 text-[0.85rem] leading-6 text-paper/85">{plot.catchphrase}</p>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <p className="min-w-0 truncate text-[0.72rem] font-medium text-mist">
                    {plot.tags.map((t) => `#${t}`).join(" ")}
                  </p>
                  <span className="btn-brand shrink-0 rounded-full px-5 py-2 text-sm">はじめる</span>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
