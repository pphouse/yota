"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AgeGate } from "@/components/AgeGate";
import { AiAssist, AiContext, Choice, inputClass, ListField, TextField, type Ask } from "@/components/create/Fields";
import { FacePicker } from "@/components/create/FacePicker";
import { TrySheet } from "@/components/create/TrySheet";
import { BackIcon, PlusIcon } from "@/components/icons";
import { TextJacket } from "@/components/TextJacket";
import { GENRES, STAT_LABELS, type Plot, type StatKey, type Viewpoint } from "@/lib/characters";
import { api } from "@/lib/client";
import {
  clearStored,
  emptyDraft,
  emptyPersona,
  fieldId,
  fieldIdCandidates,
  fromInput,
  loadStored,
  saveStored,
  storageKey,
  toPayload,
  type Draft,
  type PersonaDraft,
  type Stored,
} from "@/lib/create-draft";
import type { AssistOption } from "@/lib/ugc-assist";
import { checkWords, forTrial, missingItems, PALETTE, PROBLEM_MESSAGE, type PlotInput } from "@/lib/ugc-schema";

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

const MBTI = ["INTJ", "INTP", "ENTJ", "ENTP", "INFJ", "INFP", "ENFJ", "ENFP", "ISTJ", "ISFJ", "ESTJ", "ESFJ", "ISTP", "ISFP", "ESTP", "ESFP"];

type Phase = "loading" | "gate" | "minor" | "notfound" | "start" | "drafting" | "edit" | "saving";
type Meta = { id: string; status: "private" | "pending" | "public"; updatedAt: number };

/** 足りない項目が、画面のどの段にあるか */
function sectionOf(path: string): "basic" | "cast" | "start" | "more" {
  const head = path.split(".")[0];
  if (head === "personas") return "cast";
  if (["role", "prologue", "opening", "starterReplies"].includes(head)) return "start";
  if (head === "hooks") return "more";
  return "basic";
}

function timeText(at: number) {
  const d = new Date(at);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * 作品をつくる・直す画面。1ページにすべての項目を並べ、どの欄でも「AIで考える」で案を出せる。
 * 下のバーに「あと〇つ」と足りない項目を出し、押すとその欄へ飛ぶ。書いている途中は端末に自動で残す。
 */
export function CreatePlot() {
  const router = useRouter();
  const editId = useSearchParams().get("id");
  const key = storageKey(editId);
  const [phase, setPhase] = useState<Phase>("loading");
  const [userName, setUserName] = useState("");
  const [draft, setDraft] = useState<Draft>(() => emptyDraft("self"));
  const [meta, setMeta] = useState<Meta | null>(null);
  const [stored, setStored] = useState<Stored | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [trying, setTrying] = useState(false);
  const [startViewpoint, setStartViewpoint] = useState<Viewpoint>("self");
  const [idea, setIdea] = useState("");
  const dirty = useRef(false);
  const draftRef = useRef(draft);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  const enter = useCallback(async () => {
    const local = loadStored(key);
    if (!editId) {
      setStored(local);
      setPhase("start");
      return;
    }
    const r = await api<{ input?: PlotInput; meta?: Meta }>(`/api/ugc/${encodeURIComponent(editId)}`);
    if (!r.ok || !r.data.input || !r.data.meta) return setPhase("notfound");
    setDraft(fromInput(r.data.input));
    setMeta(r.data.meta);
    setStored(local && local.savedAt > r.data.meta.updatedAt ? local : null);
    setPhase("edit");
  }, [editId, key]);

  useEffect(() => {
    let cancelled = false;
    void api<{ session: { isMinor: boolean; name: string } | null }>("/api/session").then(async (r) => {
      if (cancelled) return;
      const s = r.ok ? r.data.session : null;
      if (!s) return setPhase("gate");
      if (s.isMinor) return setPhase("minor");
      setUserName(s.name);
      await enter();
    });
    return () => {
      cancelled = true;
    };
  }, [enter]);

  // 書いている途中の作品を、少し間をおいて端末に残す
  useEffect(() => {
    if (phase !== "edit" || !dirty.current) return;
    const t = setTimeout(() => setSavedAt(saveStored(key, draft)), 600);
    return () => clearTimeout(t);
  }, [draft, phase, key]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(t);
  }, [notice]);

  const payload = useMemo(() => toPayload(draft), [draft]);
  const missing = useMemo(() => missingItems(payload), [payload]);
  const problems = useMemo(() => checkWords(JSON.stringify(payload)), [payload]);
  const trial = useMemo(() => forTrial(payload, draft.viewpoints[0]), [payload, draft.viewpoints]);
  const left = (s: ReturnType<typeof sectionOf>) => missing.filter((m) => sectionOf(m.path) === s).length;

  const ask: Ask = useCallback(async (field, index) => {
    const r = await api<{ options?: AssistOption[]; error?: string }>("/api/ugc/assist", {
      method: "POST",
      body: JSON.stringify({ field, index: index ?? 0, plot: toPayload(draftRef.current) }),
    });
    return r.ok ? { options: r.data.options } : { error: r.data.error ?? "案を考えられませんでした" };
  }, []);

  const set = (patch: Partial<Draft>) => {
    dirty.current = true;
    setDraft((d) => ({ ...d, ...patch }));
  };
  const setPersona = (i: number, patch: Partial<PersonaDraft>) => {
    dirty.current = true;
    setDraft((d) => ({ ...d, personas: d.personas.map((p, j) => (j === i ? { ...p, ...patch } : p)) }));
  };

  function jump(path: string) {
    for (const id of fieldIdCandidates(path)) {
      const el = document.getElementById(id);
      if (!el) continue;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) el.focus({ preventScroll: true });
      return;
    }
  }

  function begin(next: Draft, isDirty: boolean) {
    dirty.current = isDirty;
    setDraft(next);
    setStored(null);
    setPhase("edit");
    window.scrollTo({ top: 0 });
  }

  async function makeDraft() {
    setError(null);
    setPhase("drafting");
    const r = await api<{ draft?: PlotInput; error?: string }>("/api/ugc/draft", { method: "POST", body: JSON.stringify({ idea, viewpoint: startViewpoint }) });
    if (!r.ok || !r.data.draft) {
      setError(r.data.error ?? "下書きを作れませんでした。もう一度お試しください");
      setPhase("start");
      return;
    }
    // AIの下書きは、すぐ端末に残す（閉じてしまっても失わないように）
    begin(fromInput(r.data.draft), true);
  }

  async function save() {
    if (missing.length) {
      setNotice(`あと${missing.length}つ：${missing.map((m) => m.label).join("・")}`);
      return jump(missing[0].path);
    }
    if (problems.length) return setNotice(PROBLEM_MESSAGE[problems[0]]);
    setError(null);
    setPhase("saving");
    const body = JSON.stringify({ plot: payload });
    const r = editId
      ? await api<{ error?: string }>(`/api/ugc/${encodeURIComponent(editId)}`, { method: "PUT", body })
      : await api<{ id?: string; error?: string }>("/api/ugc", { method: "POST", body });
    const id = editId ?? (r.data as { id?: string }).id;
    if (!r.ok || !id) {
      setError(r.data.error ?? "保存できませんでした");
      setPhase("edit");
      return;
    }
    clearStored(key);
    if (editId) {
      // 紹介ページは開き直すたびに作品を取り直すので、そのまま戻る（保存した内容を端末に残し直さない）
      dirty.current = false;
      setPhase("edit");
      router.push(`/u/${id}`);
      return;
    }
    // この画面に戻ってきたとき、前の作品が残らないように空にしておく
    dirty.current = false;
    setDraft(emptyDraft("self"));
    setIdea("");
    setSavedAt(null);
    setPhase("start");
    router.push(`/u/${id}`);
  }

  function openTry() {
    if (!trial.ok) {
      setNotice(`話すには、${trial.missing.map((m) => m.label).join("・")}を書いてください`);
      return jump(trial.missing[0].path);
    }
    setTrying(true);
  }

  if (phase === "gate")
    return (
      <AgeGate
        plot={GATE_PLOT}
        onDone={async (isMinor) => {
          if (isMinor) return setPhase("minor");
          const r = await api<{ session: { name: string } | null }>("/api/session");
          setUserName(r.data.session?.name ?? "");
          await enter();
        }}
      />
    );

  const mode: Viewpoint = draft.viewpoints.includes("watch") ? "watch" : "self";
  const editing = phase === "edit" || phase === "saving";
  const preview = {
    title: draft.title || "題名",
    tags: draft.tags,
    personas: draft.personas.map((p, i) => ({ name: p.name || `キャラ${i + 1}`, color: p.color ?? PALETTE[i % PALETTE.length], face: p.face })),
  } as unknown as Plot;

  return (
    <AiContext.Provider value={ask}>
      <main className={`mx-auto w-full max-w-xl ${editing ? "pb-48" : "pb-24"}`}>
        <header className="sticky top-0 z-20 bg-night/85 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
          <div className="flex h-12 items-center gap-2 px-3">
            <Link href={editId ? `/u/${editId}` : "/"} aria-label="戻る" className="press grid size-9 place-items-center rounded-full text-mist hover:text-paper">
              <BackIcon size={22} />
            </Link>
            <p className="text-[0.95rem] font-bold">{editId ? "作品を直す" : "作品をつくる"}</p>
            {editing && savedAt && <p className="ml-auto pr-1 text-[0.68rem] text-mist">下書きを保存しました {timeText(savedAt)}</p>}
          </div>
        </header>

        <div className="px-5 pt-3">
          {phase === "loading" && <p className="py-10 text-sm text-mist">読み込み中…</p>}
          {phase === "minor" && <p className="py-10 text-sm leading-7 text-mist">作品を作れるのは18歳以上の方です。ほかの方の作品は、ホームから遊べます。</p>}
          {phase === "notfound" && <p className="py-10 text-sm leading-7 text-mist">作品が見つかりません。直せるのは、自分で作った作品だけです。</p>}

          {(phase === "start" || phase === "drafting") && (
            <section>
              {stored && (
                <div className="mb-5 rounded-2xl border border-brand/30 bg-night-2 px-4 py-3.5">
                  <p className="text-[0.85rem] font-bold">書きかけの作品があります</p>
                  <p className="mt-0.5 truncate text-[0.8rem] text-mist">
                    「{stored.draft.title || "題名なし"}」 {timeText(stored.savedAt)} に保存
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => begin(stored.draft, false)} className="press btn-brand rounded-full px-4 py-2 text-sm">
                      続きから書く
                    </button>
                    <button
                      onClick={() => {
                        clearStored(key);
                        setStored(null);
                      }}
                      className="press rounded-full bg-night-3 px-4 py-2 text-sm font-bold"
                    >
                      捨てる
                    </button>
                  </div>
                </div>
              )}
              <h1 className="text-[1.4rem] font-black leading-snug">どんな物語をつくる？</h1>
              <p className="mt-2 text-[0.85rem] leading-6 text-mist">AIに下書きしてもらうことも、白紙から書くこともできます。どの項目も、あとで「AIで考える」で案を出せます。</p>
              <Choice
                id="start-viewpoint"
                label="遊び方"
                value={startViewpoint}
                onChange={setStartViewpoint}
                options={[
                  { value: "self", title: "あなたが主人公", hint: "キャラがあなたに話しかける" },
                  { value: "watch", title: "ふたりを見守る", hint: "ふたり（BL）の会話を眺める" },
                ]}
              />
              <div className="mt-6 rounded-3xl bg-night-2 p-4">
                <p className="text-[0.95rem] font-black">アイデアから下書き</p>
                <p className="mt-1 text-[0.78rem] leading-5 text-mist">一行書くと、題名・キャラ・最初の一言まで、AIが数秒で下書きします。</p>
                <textarea
                  aria-label="アイデア"
                  value={idea}
                  onChange={(e) => setIdea(e.target.value)}
                  maxLength={200}
                  rows={3}
                  placeholder={EXAMPLES[startViewpoint][0]}
                  className={inputClass}
                />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {EXAMPLES[startViewpoint].map((ex) => (
                    <button key={ex} onClick={() => setIdea(ex)} className="press rounded-full bg-night-3 px-3 py-1.5 text-[0.72rem] font-bold text-mist hover:text-paper">
                      {ex}
                    </button>
                  ))}
                </div>
                {error && (
                  <p role="alert" className="mt-3 text-sm text-amber">
                    {error}
                  </p>
                )}
                <button onClick={makeDraft} disabled={phase === "drafting" || idea.trim().length < 4} className="press btn-brand mt-4 w-full rounded-2xl py-3.5 text-[0.95rem]">
                  {phase === "drafting" ? "下書きを作っています…" : "AIに下書きしてもらう"}
                </button>
              </div>
              <button
                onClick={() => begin(emptyDraft(startViewpoint), false)}
                disabled={phase === "drafting"}
                className="press mt-3 w-full rounded-3xl bg-night-2 px-4 py-4 text-left"
              >
                <span className="block text-[0.95rem] font-black">白紙から書く</span>
                <span className="mt-1 block text-[0.78rem] leading-5 text-mist">自分で全部決めたい人向け。必要な項目は、下に「あと〇つ」と出ます。</span>
              </button>
              <p className="mt-5 text-xs leading-6 text-mist/80">登場人物は全員18歳以上の架空の人物にしてください。実在の人物や、ほかの作品のキャラクターは使えません。性的な内容は書けません。</p>
            </section>
          )}

          {editing && (
            <>
              {stored && (
                <div className="mb-4 rounded-2xl border border-brand/30 bg-night-2 px-4 py-3">
                  <p className="text-[0.85rem] font-bold">保存していない変更があります（{timeText(stored.savedAt)}）</p>
                  <div className="mt-2.5 flex gap-2">
                    <button onClick={() => begin(stored.draft, true)} className="press btn-brand rounded-full px-4 py-1.5 text-sm">
                      戻す
                    </button>
                    <button
                      onClick={() => {
                        clearStored(key);
                        setStored(null);
                      }}
                      className="press rounded-full bg-night-3 px-4 py-1.5 text-sm font-bold"
                    >
                      捨てる
                    </button>
                  </div>
                </div>
              )}
              {meta?.status === "public" && (
                <p className="mb-4 rounded-2xl bg-night-2 px-4 py-3 text-[0.8rem] leading-6 text-mist">
                  公開中の作品を直すと、運営がもう一度確認するまで「みんなの作品」から外れます（リンクからは遊べます）。
                </p>
              )}

              <Section n={1} title="基本" left={left("basic")}>
                <div className="mt-4 flex items-start gap-4">
                  <div className="relative aspect-[3/4] w-24 shrink-0 overflow-hidden rounded-xl">
                    <TextJacket plot={preview} />
                  </div>
                  <p className="text-[0.75rem] leading-5 text-mist">
                    完成すると、題名とキャラに合わせたジャケットの絵を作ります。キャラの画像を登録すると、文字のジャケットの背景にも使います。
                  </p>
                </div>
                <TextField id={fieldId("title")} label="題名" required max={30} value={draft.title} onChange={(v) => set({ title: v })} ai="title" hint="短く、引っかかる一言に" />
                <Choice
                  id={fieldId("viewpoints")}
                  label="遊び方"
                  value={mode}
                  onChange={(v) =>
                    set({
                      viewpoints: v === "watch" ? ["watch"] : ["self"],
                      personas: v === "watch" && draft.personas.length < 2 ? [...draft.personas, emptyPersona()] : draft.personas,
                    })
                  }
                  options={[
                    { value: "self", title: "あなたが主人公", hint: "キャラがあなたに話しかける" },
                    { value: "watch", title: "ふたりを見守る", hint: "ふたりの会話を眺める（2人）" },
                  ]}
                />
                {mode === "watch" && (
                  <label className="mt-2 flex items-center gap-2 text-[0.78rem] text-mist">
                    <input
                      type="checkbox"
                      checked={draft.viewpoints.includes("self")}
                      onChange={(e) => set({ viewpoints: e.target.checked ? ["watch", "self"] : ["watch"] })}
                      className="size-4 accent-[var(--color-brand)]"
                    />
                    あなたが主人公としても遊べるようにする（最初の一言がもう1つ要ります）
                  </label>
                )}
                <TextField
                  id={fieldId("setting")}
                  label="舞台・関係"
                  required
                  rows={5}
                  max={500}
                  value={draft.setting}
                  onChange={(v) => set({ setting: v })}
                  ai="setting"
                  userToken
                  hint="AIだけが読む設定。いつ・どこで・ふたりの関係・いまの状況。遊ぶ人のことは「あなた」か {{user}} と書きます"
                />
                <TextField
                  id={fieldId("catchphrase")}
                  label="キャッチコピー"
                  max={60}
                  value={draft.catchphrase}
                  onChange={(v) => set({ catchphrase: v })}
                  ai="catchphrase"
                  hint="一覧に出る1行。空なら紹介文の最初の文を使います"
                />
                <TextField
                  id={fieldId("intro")}
                  label="紹介文"
                  rows={4}
                  max={400}
                  value={draft.intro}
                  onChange={(v) => set({ intro: v })}
                  ai="intro"
                  hint="作品のページに出る文。空なら舞台・関係の文を使います"
                />
                <ListField id={fieldId("tags")} label="タグ" chips items={draft.tags} onChange={(v) => set({ tags: v })} maxItems={6} maxLen={12} ai="tags" placeholder="例：年上" />
                <div className="mt-5">
                  <p className="text-[0.8rem] font-bold text-paper/90">
                    カテゴリ <span className="text-[0.62rem] text-mist/70">任意・3つまで</span>
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {GENRES.map((g) => {
                      const on = draft.genres.includes(g.id);
                      return (
                        <button
                          key={g.id}
                          type="button"
                          aria-pressed={on}
                          disabled={!on && draft.genres.length >= 3}
                          onClick={() => set({ genres: on ? draft.genres.filter((x) => x !== g.id) : [...draft.genres, g.id] })}
                          className={`press rounded-full px-3 py-1.5 text-[0.75rem] font-bold disabled:opacity-40 ${on ? "bg-paper text-night" : "bg-night-3 text-mist"}`}
                        >
                          {g.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </Section>

              <Section n={2} title="登場人物" left={left("cast")} id={fieldId("personas")}>
                {draft.personas.map((p, i) => (
                  <PersonaCard
                    key={i}
                    i={i}
                    p={p}
                    removable={draft.personas.length > 1 && mode !== "watch"}
                    onChange={(patch) => setPersona(i, patch)}
                    onRemove={() => set({ personas: draft.personas.filter((_, j) => j !== i) })}
                  />
                ))}
                {draft.personas.length < 2 && (
                  <button
                    type="button"
                    onClick={() => set({ personas: [...draft.personas, emptyPersona()] })}
                    className="press mt-4 flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-white/15 py-3 text-sm font-bold text-mist hover:text-paper"
                  >
                    <PlusIcon size={16} /> 登場人物を足す（2人まで）
                  </button>
                )}
              </Section>

              <Section n={3} title="始まり" left={left("start")}>
                {draft.viewpoints.includes("self") && (
                  <TextField
                    id={fieldId("role")}
                    label="あなたの役"
                    max={120}
                    value={draft.role}
                    onChange={(v) => set({ role: v })}
                    ai="role"
                    hint="物語の中での、遊ぶ人の立場（例：新しく配属された後輩）"
                  />
                )}
                <TextField
                  id={fieldId("prologue")}
                  label="最初の情景"
                  rows={2}
                  max={200}
                  value={draft.prologue}
                  onChange={(v) => set({ prologue: v })}
                  ai="prologue"
                  userToken
                  hint="会話の前に出るナレーション。空なら出しません"
                />
                {draft.viewpoints.map((v) => (
                  <div key={v}>
                    <TextField
                      id={fieldId(`opening.${v}`)}
                      label={draft.viewpoints.length > 1 ? `最初の一言（${v === "self" ? "あなたが主人公" : "ふたりを見守る"}）` : "最初の一言"}
                      required
                      rows={4}
                      max={v === "self" ? 300 : 400}
                      value={draft.opening[v]}
                      onChange={(text) => set({ opening: { ...draft.opening, [v]: text } })}
                      ai={`opening.${v}`}
                      userToken
                      hint={v === "self" ? "キャラからの最初の話しかけ。動作は *…* で囲みます" : "ふたりの会話の始まり。台詞は 名前「…」 の形で、2人とも話します"}
                    />
                    <ListField
                      id={fieldId(`starterReplies.${v}`)}
                      label={v === "self" ? "あなたの返事の候補" : "見守る人の指示の候補"}
                      items={draft.starterReplies[v]}
                      onChange={(items) => set({ starterReplies: { ...draft.starterReplies, [v]: items } })}
                      maxItems={3}
                      maxLen={40}
                      ai={`starterReplies.${v}`}
                      hint="最初の一言のあとに出るボタン。空ならAIが作ります。"
                    />
                  </div>
                ))}
              </Section>

              <Section n={4} title="展開" left={left("more")}>
                <ListField
                  id={fieldId("hooks")}
                  label="山場の候補"
                  items={draft.hooks}
                  onChange={(v) => set({ hooks: v })}
                  maxItems={4}
                  maxLen={100}
                  ai="hooks"
                  placeholder="例：元恋人が店に現れる"
                  hint="会話の途中で、AIが起こす出来事。空ならおまかせです。"
                />
              </Section>

              {error && (
                <p role="alert" className="mt-5 text-sm text-amber">
                  {error}
                </p>
              )}
              <p className="mt-6 text-xs leading-6 text-mist/80">
                登場人物は全員18歳以上の架空の人物にしてください。実在の人物や、ほかの作品のキャラクター、使ってよいか分からない画像は使えません。性的な内容は書けません。
              </p>
            </>
          )}
        </div>
      </main>

      {editing && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/5 bg-night/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
          <div className="mx-auto max-w-xl px-4 pb-3 pt-2.5">
            {notice && (
              <p role="status" className="mb-2 rounded-xl bg-night-3 px-3 py-2 text-[0.8rem] leading-5 text-paper">
                {notice}
              </p>
            )}
            {missing.length > 0 ? (
              <div className="-mx-4 mb-2 flex items-center gap-1.5 overflow-x-auto px-4 [scrollbar-width:none]">
                <span className="shrink-0 text-[0.72rem] font-bold text-amber">あと{missing.length}つ</span>
                {missing.map((m) => (
                  <button
                    key={m.path}
                    type="button"
                    onClick={() => jump(m.path)}
                    className="press shrink-0 rounded-full bg-amber/15 px-2.5 py-1 text-[0.72rem] font-bold text-amber"
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            ) : problems.length > 0 ? (
              <p className="mb-2 text-[0.75rem] leading-5 text-amber">{PROBLEM_MESSAGE[problems[0]]}</p>
            ) : (
              <p className="mb-2 text-[0.72rem] font-bold text-emerald-300">必要な項目はそろいました</p>
            )}
            <div className="grid grid-cols-[auto_1fr] gap-2">
              <button type="button" onClick={openTry} className={`press rounded-2xl px-4 py-3.5 text-sm font-bold ${trial.ok ? "bg-night-3 text-paper" : "bg-night-3/60 text-mist"}`}>
                試しに話す
              </button>
              <button type="button" onClick={save} disabled={phase === "saving"} className={`press rounded-2xl py-3.5 text-[0.95rem] font-black ${missing.length || problems.length ? "bg-night-3 text-mist" : "btn-brand"}`}>
                {phase === "saving" ? "保存しています…" : missing.length ? `あと${missing.length}つで完成` : editId ? "保存する" : "完成"}
              </button>
            </div>
          </div>
        </div>
      )}

      {trying && <TrySheet payload={payload} userName={userName} onClose={() => setTrying(false)} />}
    </AiContext.Provider>
  );
}

function Section({ n, title, left, id, children }: { n: number; title: string; left: number; id?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-6 scroll-mt-16 rounded-3xl bg-night-2/70 px-4 pb-5 pt-4">
      <h2 className="flex items-center gap-2 text-[1.05rem] font-black">
        <span className="grid size-6 place-items-center rounded-full bg-paper text-[0.75rem] text-night">{n}</span>
        {title}
        {left > 0 ? <span className="ml-auto text-[0.7rem] font-bold text-amber">あと{left}つ</span> : <span className="ml-auto text-[0.7rem] font-bold text-emerald-300">OK</span>}
      </h2>
      {children}
    </section>
  );
}

function PersonaCard({
  i,
  p,
  removable,
  onChange,
  onRemove,
}: {
  i: number;
  p: PersonaDraft;
  removable: boolean;
  onChange: (patch: Partial<PersonaDraft>) => void;
  onRemove: () => void;
}) {
  const color = p.color ?? PALETTE[i % PALETTE.length];
  const path = (k: string) => fieldId(`personas.${i}.${k}`);
  const needsOne = !p.profile.trim() && !p.personality.trim();
  return (
    <fieldset className="mt-4 rounded-2xl bg-night-3/40 p-3.5">
      <legend className="sr-only">登場人物 {i + 1}</legend>
      <div className="flex items-start gap-3">
        <FacePicker id={path("face")} face={p.face} color={color} onChange={(face) => onChange({ face })} />
        <div className="min-w-0 flex-1">
          <p className="text-[0.8rem] font-black">
            登場人物 {i + 1}
            {p.name && <span className="ml-1.5 font-bold text-mist">{p.name}</span>}
          </p>
          <p className="mt-1.5 text-[0.65rem] font-bold text-mist">推し色</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`推し色 ${c}`}
                aria-pressed={color === c}
                onClick={() => onChange({ color: c })}
                className={`press size-6 rounded-full ${color === c ? "ring-2 ring-paper ring-offset-2 ring-offset-night-2" : ""}`}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
        {removable && (
          <button type="button" onClick={onRemove} className="press shrink-0 rounded-full px-2 py-1 text-[0.72rem] font-bold text-mist hover:text-paper">
            消す
          </button>
        )}
      </div>
      <div className="grid grid-cols-[1fr_6.5rem] gap-3">
        <TextField id={path("name")} label="名前" required max={20} value={p.name} onChange={(name) => onChange({ name })} ai="name" aiIndex={i} />
        <TextField id={path("age")} label="年齢" required max={3} inputMode="numeric" value={p.age} onChange={(age) => onChange({ age })} hint="18歳以上" />
      </div>
      <TextField
        id={path("profile")}
        label="見た目・立場"
        required={needsOne}
        rows={2}
        max={200}
        value={p.profile}
        onChange={(profile) => onChange({ profile })}
        ai="profile"
        aiIndex={i}
        hint="職業・外見・背景。見た目か性格のどちらかは必須です"
      />
      <TextField
        id={path("personality")}
        label="性格"
        required={needsOne}
        rows={3}
        max={300}
        value={p.personality}
        onChange={(personality) => onChange({ personality })}
        ai="personality"
        aiIndex={i}
        userToken
        hint="表の顔と、親しくなると見える一面"
      />
      <TextField
        id={path("speech")}
        label="口調"
        required
        rows={3}
        max={300}
        value={p.speech}
        onChange={(speech) => onChange({ speech })}
        ai="speech"
        aiIndex={i}
        userToken
        hint="話し方と短い例。「一人称は俺、相手を{{user}}と呼ぶ」のように書くと安定します"
      />
      <Examples i={i} p={p} onChange={onChange} />
      <details className="group mt-5 rounded-xl bg-night-3/50 px-3 py-2.5">
        <summary className="cursor-pointer list-none text-[0.8rem] font-bold text-paper/90">
          <span className="mr-1 inline-block transition group-open:rotate-90">›</span> もっと設定する（好み・口癖・MBTI・パラメーター）
        </summary>
        <div className="grid grid-cols-2 gap-x-3">
          <TextField id={path("reading")} label="名前の読み" max={30} value={p.reading} onChange={(reading) => onChange({ reading })} />
          <TextField id={path("height")} label="身長（cm）" max={3} inputMode="numeric" value={p.height} onChange={(height) => onChange({ height })} />
        </div>
        <TextField id={path("likes")} label="好きなもの" max={150} value={p.likes} onChange={(likes) => onChange({ likes })} hint="「、」で区切って5つまで" />
        <TextField id={path("dislikes")} label="苦手なもの" max={150} value={p.dislikes} onChange={(dislikes) => onChange({ dislikes })} hint="「、」で区切って5つまで" />
        <TextField id={path("habits")} label="口癖" max={150} value={p.habits} onChange={(habits) => onChange({ habits })} hint="「、」で区切って5つまで。ときどき出ます" />
        <TextField
          id={path("inLove")}
          label="好きになったら"
          rows={2}
          max={200}
          value={p.inLove}
          onChange={(inLove) => onChange({ inLove })}
          userToken
          hint="関係が深まってから見せる一面"
        />
        <div className="mt-5">
          <label htmlFor={path("mbti")} className="text-[0.8rem] font-bold text-paper/90">
            MBTI <span className="text-[0.62rem] text-mist/70">任意</span>
          </label>
          <select id={path("mbti")} value={p.mbti} onChange={(e) => onChange({ mbti: e.target.value })} className={inputClass}>
            <option value="">決めない</option>
            {MBTI.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </div>
        <div className="mt-5">
          <p className="flex items-center text-[0.8rem] font-bold text-paper/90">
            性格パラメーター <span className="ml-1.5 text-[0.62rem] text-mist/70">任意・AIの返事に反映します</span>
            {p.stats && (
              <button type="button" onClick={() => onChange({ stats: undefined })} className="press ml-auto text-[0.7rem] font-bold text-mist hover:text-paper">
                外す
              </button>
            )}
          </p>
          {p.stats ? (
            <ul className="mt-2 space-y-2">
              {(Object.keys(STAT_LABELS) as StatKey[]).map((k) => (
                <li key={k} className="grid grid-cols-[5rem_1fr_2rem] items-center gap-2 text-[0.75rem]">
                  <label htmlFor={`${path("stats")}-${k}`} className="font-bold text-mist">
                    {STAT_LABELS[k]}
                  </label>
                  <input
                    id={`${path("stats")}-${k}`}
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={p.stats![k]}
                    onChange={(e) => onChange({ stats: { ...p.stats!, [k]: Number(e.target.value) } })}
                    style={{ accentColor: color }}
                  />
                  <span className="text-right tabular-nums text-mist">{p.stats![k]}</span>
                </li>
              ))}
            </ul>
          ) : (
            <button
              type="button"
              onClick={() => onChange({ stats: Object.fromEntries(Object.keys(STAT_LABELS).map((k) => [k, 50])) as Record<StatKey, number> })}
              className="press mt-2 rounded-full bg-night-3 px-3 py-1.5 text-[0.75rem] font-bold text-mist hover:text-paper"
            >
              パラメーターを決める
            </button>
          )}
        </div>
      </details>
    </fieldset>
  );
}

/** 口調の例：こう言われたら、こう返す（3つまで） */
function Examples({ i, p, onChange }: { i: number; p: PersonaDraft; onChange: (patch: Partial<PersonaDraft>) => void }) {
  const set = (j: number, patch: Partial<{ user: string; reply: string }>) => onChange({ examples: p.examples.map((e, k) => (k === j ? { ...e, ...patch } : e)) });
  const add = (e = { user: "", reply: "" }) => p.examples.length < 3 && onChange({ examples: [...p.examples, e] });
  const who = p.name || `キャラ${i + 1}`;
  return (
    <div id={fieldId(`personas.${i}.examples`)} className="mt-5">
      <div className="flex items-center gap-2">
        <p className="text-[0.8rem] font-bold text-paper/90">
          口調の例 <span className="text-[0.62rem] text-mist/70">任意</span>
        </p>
        <span className="ml-auto">
          {p.examples.length < 3 && <AiAssist field="examples" index={i} multi onPick={(o) => typeof o !== "string" && add(o)} />}
        </span>
      </div>
      <p className="mt-0.5 text-[0.7rem] leading-5 text-mist/80">こう言われたら、こう返す。AIが話し方をつかみやすくなります</p>
      <ul className="mt-1.5 space-y-2">
        {p.examples.map((e, j) => (
          <li key={j} className="rounded-xl bg-night-3/60 p-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[0.68rem] font-bold text-mist">例 {j + 1}</span>
              <button
                type="button"
                aria-label={`例 ${j + 1} を消す`}
                onClick={() => onChange({ examples: p.examples.filter((_, k) => k !== j) })}
                className="press px-1 text-[0.8rem] text-mist hover:text-paper"
              >
                ×
              </button>
            </div>
            <input
              aria-label={`例 ${j + 1}：相手の言葉`}
              value={e.user}
              onChange={(ev) => set(j, { user: ev.target.value })}
              maxLength={150}
              placeholder="相手（あなた）の言葉"
              className={inputClass}
            />
            <input
              aria-label={`例 ${j + 1}：${who}の返事`}
              value={e.reply}
              onChange={(ev) => set(j, { reply: ev.target.value })}
              maxLength={150}
              placeholder={`${who}の返事`}
              className={inputClass}
            />
          </li>
        ))}
      </ul>
      {p.examples.length < 3 && (
        <button type="button" onClick={() => add()} className="press mt-2 inline-flex items-center gap-1 rounded-full bg-night-3 px-3 py-1.5 text-[0.75rem] font-bold text-mist hover:text-paper">
          <PlusIcon size={14} /> 例を足す
        </button>
      )}
    </div>
  );
}
