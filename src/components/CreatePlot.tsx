"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AgeGate } from "@/components/AgeGate";
import { BackIcon } from "@/components/icons";
import { TextJacket } from "@/components/TextJacket";
import type { Plot } from "@/lib/characters";
import { api, getSessionInfo } from "@/lib/client";
import { toPlot, type PlotInput } from "@/lib/ugc-schema";

// 年齢確認の画面に渡す、作品の代わり（絵もキャラも出さない）
const GATE_PLOT: Plot = {
  id: "create",
  title: "作品をつくる",
  catchphrase: "",
  tags: [],
  genres: ["daily"],
  viewpoints: ["self"],
  personas: [],
  setting: "",
  opening: { self: undefined, watch: undefined },
  starterReplies: { self: undefined, watch: undefined },
  hooks: [],
  hue: 280,
};

const EXAMPLES = {
  self: ["隣の席の無口な先輩が、実は私の小説の読者だった", "毎朝同じ電車の彼が、今日だけ乗ってこなかった", "契約が切れる日、執事が初めて名前で呼んだ"],
  watch: ["犬猿の仲の同期社員が、出張先で同じ部屋に泊まる", "解散寸前のバンドのボーカルとギター", "宿敵の剣士ふたりが、呪いで手を離せなくなる"],
};

type Phase = "loading" | "gate" | "minor" | "idea" | "drafting" | "edit" | "saving";

const field = "mt-1.5 w-full rounded-xl bg-night-3 px-3 py-2.5 text-sm leading-6 text-paper focus:outline-none focus:ring-2 focus:ring-brand/60";
const label = "mt-4 block text-xs font-bold text-mist";

/** 作品をつくる：一行のアイデア → AIの下書き → 直す → 保存 */
export function CreatePlot() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("loading");
  const [idea, setIdea] = useState("");
  const [viewpoint, setViewpoint] = useState<"self" | "watch">("self");
  const [draft, setDraft] = useState<PlotInput | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getSessionInfo().then((info) => setPhase(!info?.session ? "gate" : info.session.isMinor ? "minor" : "idea"));
  }, []);

  async function makeDraft() {
    setError(null);
    setPhase("drafting");
    const r = await api<{ draft?: PlotInput; error?: string }>("/api/ugc/draft", { method: "POST", body: JSON.stringify({ idea, viewpoint }) });
    if (!r.ok || !r.data.draft) {
      setError(r.data.error ?? "下書きを作れませんでした。もう一度お試しください");
      setPhase("idea");
      return;
    }
    setDraft(r.data.draft);
    setPhase("edit");
  }

  async function save() {
    if (!draft) return;
    setError(null);
    setPhase("saving");
    const r = await api<{ id?: string; error?: string }>("/api/ugc", { method: "POST", body: JSON.stringify({ plot: draft }) });
    if (!r.ok || !r.data.id) {
      setError(r.data.error ?? "保存できませんでした");
      setPhase("edit");
      return;
    }
    router.push(`/u/${r.data.id}`);
  }

  const set = (patch: Partial<PlotInput>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const setPersona = (i: number, patch: Partial<PlotInput["personas"][number]>) =>
    setDraft((d) => (d ? { ...d, personas: d.personas.map((p, j) => (j === i ? { ...p, ...patch } : p)) } : d));

  if (phase === "gate") return <AgeGate plot={GATE_PLOT} onDone={(isMinor) => setPhase(isMinor ? "minor" : "idea")} />;

  return (
    <main className="mx-auto w-full max-w-xl pb-24">
      <header className="sticky top-0 z-20 bg-night/80 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="flex h-12 items-center gap-2 px-3">
          <Link href="/" aria-label="物語の一覧へ" className="press grid size-9 place-items-center rounded-full text-mist hover:text-paper">
            <BackIcon size={22} />
          </Link>
          <p className="text-[0.95rem] font-bold">作品をつくる</p>
        </div>
      </header>

      <div className="px-5 pt-4">
        {phase === "loading" && <p className="py-10 text-sm text-mist">読み込み中…</p>}
        {phase === "minor" && <p className="py-10 text-sm leading-7 text-mist">作品を作れるのは18歳以上の方です。ほかの方の作品は、ホームから遊べます。</p>}

        {(phase === "idea" || phase === "drafting") && (
          <section>
            <h1 className="text-[1.4rem] font-black leading-snug">どんな物語を読みたい？</h1>
            <p className="mt-2 text-[0.85rem] leading-6 text-mist">一行のアイデアを書くと、AIがタイトル・キャラクター・最初の一言まで下書きします。あとから直せます。</p>
            <div role="radiogroup" aria-label="遊び方" className="mt-5 grid grid-cols-2 gap-2">
              {(
                [
                  ["self", "あなたが主人公", "キャラがあなたに話しかける"],
                  ["watch", "ふたりを見守る", "ふたり（BL）の会話を眺める"],
                ] as const
              ).map(([v, title, hint]) => (
                <button
                  key={v}
                  role="radio"
                  aria-checked={viewpoint === v}
                  onClick={() => setViewpoint(v)}
                  className={`press rounded-2xl px-3 py-3 text-left ${viewpoint === v ? "bg-paper text-night" : "bg-night-3 text-paper"}`}
                >
                  <span className="block text-sm font-black">{title}</span>
                  <span className={`mt-0.5 block text-[0.72rem] ${viewpoint === v ? "text-night/70" : "text-mist"}`}>{hint}</span>
                </button>
              ))}
            </div>
            <label className={label}>
              アイデア（200文字まで）
              <textarea value={idea} onChange={(e) => setIdea(e.target.value)} maxLength={200} rows={3} placeholder={EXAMPLES[viewpoint][0]} className={field} />
            </label>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {EXAMPLES[viewpoint].map((ex) => (
                <button key={ex} onClick={() => setIdea(ex)} className="press rounded-full bg-night-3 px-3 py-1.5 text-[0.72rem] font-bold text-mist hover:text-paper">
                  {ex}
                </button>
              ))}
            </div>
            {error && (
              <p role="alert" className="mt-4 text-sm text-amber">
                {error}
              </p>
            )}
            <button onClick={makeDraft} disabled={phase === "drafting" || idea.trim().length < 4} className="press btn-brand mt-6 w-full rounded-2xl py-4 text-base">
              {phase === "drafting" ? "下書きを作っています…（30秒ほど）" : "AIに下書きしてもらう"}
            </button>
            <p className="mt-4 text-xs leading-6 text-mist/80">登場人物は全員18歳以上の架空の人物にしてください。実在の人物や、ほかの作品のキャラクターは使えません。性的な内容は書けません。</p>
          </section>
        )}

        {(phase === "edit" || phase === "saving") && draft && (
          <section>
            <h1 className="text-[1.4rem] font-black leading-snug">下書きを直す</h1>
            <p className="mt-2 text-[0.85rem] leading-6 text-mist">気になるところを直して「この内容で作る」を押してください。ジャケットの絵は、作ったあとに自動で作ります。</p>
            <div className="relative mx-auto mt-5 aspect-[3/4] w-40 overflow-hidden rounded-2xl">
              <TextJacket plot={toPlot("preview", draft)} />
            </div>
            <label className={label}>
              タイトル（30文字まで）
              <input value={draft.title} onChange={(e) => set({ title: e.target.value })} maxLength={30} className={field} />
            </label>
            <label className={label}>
              キャッチコピー（60文字まで）
              <input value={draft.catchphrase} onChange={(e) => set({ catchphrase: e.target.value })} maxLength={60} className={field} />
            </label>
            <label className={label}>
              タグ（読点か空白で区切る）
              <input
                value={draft.tags.join("、")}
                onChange={(e) => set({ tags: e.target.value.split(/[、,\s]+/).filter(Boolean).slice(0, 6) })}
                className={field}
              />
            </label>
            <label className={label}>
              紹介文
              <textarea value={draft.intro} onChange={(e) => set({ intro: e.target.value })} maxLength={400} rows={5} className={field} />
            </label>
            <label className={label}>
              舞台・関係（AIだけが読む設定）
              <textarea value={draft.setting} onChange={(e) => set({ setting: e.target.value })} maxLength={500} rows={4} className={field} />
            </label>
            {draft.viewpoints.includes("self") && (
              <label className={label}>
                あなたの役
                <input value={draft.role ?? ""} onChange={(e) => set({ role: e.target.value })} maxLength={120} className={field} />
              </label>
            )}
            {draft.personas.map((p, i) => (
              <fieldset key={i} className="mt-6 rounded-2xl bg-night-2 p-4">
                <legend className="px-1 text-sm font-black">登場人物 {i + 1}</legend>
                <div className="grid grid-cols-[1fr_5rem] gap-2">
                  <label className="block text-xs font-bold text-mist">
                    名前
                    <input value={p.name} onChange={(e) => setPersona(i, { name: e.target.value })} maxLength={20} className={field} />
                  </label>
                  <label className="block text-xs font-bold text-mist">
                    年齢
                    <input type="number" min={18} value={p.age} onChange={(e) => setPersona(i, { age: Number(e.target.value) })} className={field} />
                  </label>
                </div>
                <label className={label}>
                  見た目・立場
                  <textarea value={p.profile} onChange={(e) => setPersona(i, { profile: e.target.value })} maxLength={200} rows={2} className={field} />
                </label>
                <label className={label}>
                  性格
                  <textarea value={p.personality} onChange={(e) => setPersona(i, { personality: e.target.value })} maxLength={300} rows={3} className={field} />
                </label>
                <label className={label}>
                  口調（一人称・相手の呼び方も）
                  <textarea value={p.speech} onChange={(e) => setPersona(i, { speech: e.target.value })} maxLength={300} rows={3} className={field} />
                </label>
              </fieldset>
            ))}
            {draft.viewpoints.map((v) => (
              <label key={v} className={label}>
                最初の一言（{v === "self" ? "あなたが主人公" : "ふたりを見守る"}）
                <textarea
                  value={draft.opening[v] ?? ""}
                  onChange={(e) => set({ opening: { ...draft.opening, [v]: e.target.value } })}
                  maxLength={v === "self" ? 300 : 400}
                  rows={4}
                  className={field}
                />
              </label>
            ))}
            {error && (
              <p role="alert" className="mt-4 text-sm text-amber">
                {error}
              </p>
            )}
            <button onClick={save} disabled={phase === "saving"} className="press btn-brand mt-6 w-full rounded-2xl py-4 text-base">
              {phase === "saving" ? "作っています…" : "この内容で作る"}
            </button>
            <button onClick={() => setPhase("idea")} disabled={phase === "saving"} className="press mt-2 w-full rounded-2xl bg-night-3 py-3 text-sm font-bold">
              アイデアからやり直す
            </button>
          </section>
        )}
      </div>
    </main>
  );
}
