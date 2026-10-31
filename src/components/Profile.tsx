import { Avatar } from "@/components/Avatar";
import { StatRadar } from "@/components/StatRadar";
import { pronouns, type Persona } from "@/lib/characters";

/** 登場人物のプロフィール。zeta の紹介のように、見た目・性格・好き嫌い・口癖・好きになったら、まで見せる */
export function Profile({ persona: p }: { persona: Persona }) {
  const { first, you } = pronouns(p);
  const rows: [string, string | undefined][] = [
    ["見た目", p.profile],
    ["性格", p.personality],
    ["好き", p.likes?.join("、")],
    ["嫌い", p.dislikes?.join("、")],
    ["口癖", p.habits?.map((h) => `「${h}」`).join(" ")],
    ["一人称／二人称", first ? `${first}／${you ?? "名前で呼ぶ"}` : undefined],
    ["好きになったら", p.inLove],
  ];
  return (
    <article className="rounded-3xl bg-night-2 p-4">
      <div className="flex items-center gap-3.5">
        <Avatar persona={p} size={64} />
        <div className="min-w-0">
          <p className="text-[1.1rem] font-black leading-tight" style={{ color: p.color }}>
            {p.name}
          </p>
          {p.reading && <p className="mt-0.5 text-[0.75rem] text-mist">{p.reading}</p>}
          <p className="mt-1 flex items-center gap-2 text-[0.8rem] text-paper/80">
            {p.age}歳{p.height ? `・${p.height}cm` : ""}
            {p.mbti && <span className="rounded-full bg-night-3 px-2 py-0.5 text-[0.7rem] font-bold tracking-wider text-paper">{p.mbti}</span>}
          </p>
        </div>
      </div>
      {p.stats && (
        <div className="mt-4">
          <p className="text-[0.72rem] font-bold text-mist">性格パラメーター</p>
          <StatRadar persona={p} />
          <p className="mt-1 text-center text-[0.7rem] text-mist/80">会話でのふるまいにも反映されます</p>
        </div>
      )}
      <dl className="mt-4 space-y-3">
        {rows
          .filter((r): r is [string, string] => Boolean(r[1]))
          .map(([label, value]) => (
            <div key={label}>
              <dt className="text-[0.72rem] font-bold text-mist">{label}</dt>
              <dd className="break-phrase mt-0.5 text-[0.88rem] leading-7 text-paper/90">{value}</dd>
            </div>
          ))}
      </dl>
    </article>
  );
}
