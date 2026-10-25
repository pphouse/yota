import { PlotCard } from "@/components/PlotList";
import type { Plot } from "@/lib/characters";

/** テーマごとの棚。小さめの表紙を横にすべらせて見せる */
export function Shelf({ title, hint, plots }: { title: string; hint?: string; plots: Plot[] }) {
  if (plots.length === 0) return null;
  return (
    <section aria-label={title} className="mt-9">
      <h2 className="px-5 text-[1.15rem] font-black">{title}</h2>
      {hint && <p className="mt-1 px-5 text-xs text-mist">{hint}</p>}
      <ul className="rail mt-3 flex snap-x gap-3 overflow-x-auto scroll-px-5 px-5 pb-1">
        {plots.map((plot) => (
          <li key={plot.id} className="w-[40%] shrink-0 snap-start sm:w-[30%]">
            <PlotCard plot={plot} />
          </li>
        ))}
      </ul>
    </section>
  );
}
