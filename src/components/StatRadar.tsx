import { STAT_LABELS, type Persona, type StatKey } from "@/lib/characters";

// 左右に項目名が出るので、横長にとる
const W = 340;
const H = 250;
const CX = W / 2;
const CY = H / 2;
const R = 82;
const KEYS = Object.keys(STAT_LABELS) as StatKey[];

/** i 番目の軸の、半径 r の点（上から時計回り） */
function point(i: number, r: number): [number, number] {
  const a = -Math.PI / 2 + (i * 2 * Math.PI) / KEYS.length;
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
}

const polygon = (rs: number[]) => rs.map((r, i) => point(i, r).map((v) => v.toFixed(1)).join(",")).join(" ");

/** 性格パラメーターのレーダーチャート（推し色で塗る） */
export function StatRadar({ persona }: { persona: Persona }) {
  const stats = persona.stats;
  if (!stats) return null;
  const summary = KEYS.map((k) => `${STAT_LABELS[k]}${stats[k]}`).join("、");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`性格パラメーター：${summary}`} className="mx-auto block w-full max-w-[340px]">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <polygon key={f} points={polygon(KEYS.map(() => R * f))} fill="none" stroke="currentColor" strokeOpacity={f === 1 ? 0.28 : 0.14} className="text-mist" />
      ))}
      {KEYS.map((_, i) => {
        const [x, y] = point(i, R);
        return <line key={i} x1={CX} y1={CY} x2={x} y2={y} stroke="currentColor" strokeOpacity={0.14} className="text-mist" />;
      })}
      <polygon points={polygon(KEYS.map((k) => (R * stats[k]) / 100))} fill={persona.color} fillOpacity={0.32} stroke={persona.color} strokeWidth={2} strokeLinejoin="round" />
      {KEYS.map((k, i) => {
        const [x, y] = point(i, R + 16);
        const anchor = Math.abs(x - CX) < 4 ? "middle" : x > CX ? "start" : "end";
        const dy = anchor === "middle" ? (y < CY ? -4 : 4) : 0;
        return (
          <text key={k} x={x} y={y + dy} textAnchor={anchor} dominantBaseline="middle" className="fill-paper text-[11px] font-bold">
            {STAT_LABELS[k]}
            <tspan dx={4} className="fill-mist font-medium">
              {stats[k]}
            </tspan>
          </text>
        );
      })}
    </svg>
  );
}
