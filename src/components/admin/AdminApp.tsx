"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";
import { COMPARE, NOTE_CATEGORIES, type Compare, type NoteCategory } from "@/lib/feedback";

type Period = {
  newUsers: number;
  activeUsers: number;
  conversations: number;
  messages: number;
  ratings: number;
  ratingAvg: number | null;
  notes: number;
  reports: number;
  works: number;
  xDiagnoses: number;
  costYen: number;
};
type Stats = { today: Period; week: Period; pending: number; topPlots: { plotId: string; title: string; users: number; conversations: number }[] };
type Feedback = {
  id: string;
  kind: "note" | "rating";
  category: string | null;
  score: number | null;
  compare: string | null;
  text: string;
  contact: string;
  plotId: string | null;
  plotTitle: string | null;
  turns: number | null;
  ref: string;
  createdAt: number;
};
type Work = {
  id: string;
  title: string;
  catchphrase: string;
  author: string;
  status: "private" | "pending" | "public" | "removed";
  official: boolean;
  jacket: string | null;
  personas: string[];
  reports: number;
  createdAt: number;
  updatedAt: number;
};
type Cost = { totalYen: number; calls: number; unknownCost: number; days: { day: string; calls: number; yen: number }[]; purposes: { purpose: string; calls: number; yen: number; input: number; output: number }[] };

const TABS = [
  ["overview", "概要"],
  ["notes", "ご意見・通報"],
  ["ratings", "評価"],
  ["works", "作品"],
  ["cost", "費用"],
] as const;
type Tab = (typeof TABS)[number][0];

const date = (t: number) => new Date(t).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
const yen = (n: number) => `${n.toLocaleString("ja-JP")}円`;
const card = "rounded-2xl bg-night-2 p-4";
const chip = (on: boolean) => `press rounded-full px-3 py-1.5 text-[0.75rem] font-bold ${on ? "bg-paper text-night" : "bg-night-3 text-mist hover:text-paper"}`;

/** 管理者画面。パスワードでログインし、数字・ご意見・評価・作品・費用を見る。作品はここから追加・承認する */
export function AdminApp() {
  const [me, setMe] = useState<{ enabled: boolean; admin: boolean } | null>(null);
  const [tab, setTab] = useState<Tab>("overview");

  const load = useCallback(() => void api<{ enabled: boolean; admin: boolean }>("/api/admin/me").then((r) => setMe(r.ok ? r.data : { enabled: false, admin: false })), []);
  useEffect(load, [load]);

  if (!me) return <p className="p-6 text-sm text-mist">読み込み中…</p>;
  if (!me.enabled)
    return (
      <Shell>
        <p className="mt-8 text-sm leading-7 text-mist">
          管理者画面はまだ使えません。Vercel の環境変数に <code className="rounded bg-night-3 px-1.5">ADMIN_PASSWORD</code>（8文字以上）を入れて、再デプロイしてください。
        </p>
      </Shell>
    );
  if (!me.admin) return <Login onDone={load} />;

  return (
    <Shell
      right={
        <div className="flex items-center gap-2">
          <Link href="/create?official=1" className="press btn-brand rounded-full px-3.5 py-1.5 text-[0.78rem]">
            ＋ 作品を追加
          </Link>
          <button
            onClick={async () => {
              await api("/api/admin/logout", { method: "POST" });
              load();
            }}
            className="press rounded-full px-2 py-1.5 text-[0.75rem] font-bold text-mist hover:text-paper"
          >
            ログアウト
          </button>
        </div>
      }
    >
      <nav className="-mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {TABS.map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className={chip(tab === id)} aria-pressed={tab === id}>
            {label}
          </button>
        ))}
      </nav>
      <div className="mt-4">
        {tab === "overview" && <Overview onPending={() => setTab("works")} />}
        {tab === "notes" && <Notes />}
        {tab === "ratings" && <Ratings />}
        {tab === "works" && <Works />}
        {tab === "cost" && <CostView />}
      </div>
    </Shell>
  );
}

function Shell({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-16">
      <header className="sticky top-0 z-20 -mx-4 flex h-14 items-center gap-2 bg-night/90 px-4 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <Link href="/" className="text-[1rem] font-black">
          yota <span className="text-mist">管理</span>
        </Link>
        <span className="ml-auto">{right}</span>
      </header>
      {children}
    </main>
  );
}

function Login({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Shell>
      <form
        className={`${card} mx-auto mt-16 max-w-sm`}
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          const r = await api<{ error?: string }>("/api/admin/login", { method: "POST", body: JSON.stringify({ password }) });
          setBusy(false);
          if (!r.ok) return setError(r.data.error ?? "ログインできませんでした");
          onDone();
        }}
      >
        <p className="text-[1rem] font-black">管理者ログイン</p>
        <label className="mt-4 block text-xs font-bold text-mist">
          パスワード
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1.5 w-full rounded-xl bg-night-3 px-3 py-2.5 text-sm text-paper focus:outline-none focus:ring-2 focus:ring-brand/60"
          />
        </label>
        {error && (
          <p role="alert" className="mt-3 text-sm text-amber">
            {error}
          </p>
        )}
        <button disabled={busy || !password} className="press btn-brand mt-4 w-full rounded-xl py-3 text-sm">
          {busy ? "確かめています…" : "ログイン"}
        </button>
      </form>
    </Shell>
  );
}

function useData<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(() => {
    void api<T & { error?: string }>(url).then((r) => {
      if (r.ok) {
        setData(r.data);
        setError(null);
      } else setError(r.data.error ?? "読み込めませんでした");
    });
  }, [url]);
  useEffect(reload, [reload]);
  return { data, error, reload };
}

function Overview({ onPending }: { onPending: () => void }) {
  const { data, error } = useData<Stats>("/api/admin/stats");
  if (error) return <p className="text-sm text-amber">{error}</p>;
  if (!data) return <p className="text-sm text-mist">読み込み中…</p>;
  const rows: [string, (p: Period) => string][] = [
    ["新しい人", (p) => p.newUsers.toLocaleString()],
    ["話した人", (p) => p.activeUsers.toLocaleString()],
    ["始まった会話", (p) => p.conversations.toLocaleString()],
    ["送られたメッセージ", (p) => p.messages.toLocaleString()],
    ["評価（平均）", (p) => (p.ratings ? `${p.ratings}件（${p.ratingAvg}）` : "0件")],
    ["ご意見", (p) => p.notes.toLocaleString()],
    ["通報", (p) => p.reports.toLocaleString()],
    ["作られた作品", (p) => p.works.toLocaleString()],
    ["X の診断", (p) => p.xDiagnoses.toLocaleString()],
    ["文章AIの費用", (p) => yen(p.costYen)],
  ];
  return (
    <div className="space-y-4">
      {data.pending > 0 && (
        <button onClick={onPending} className={`${card} press flex w-full items-center justify-between text-left ring-1 ring-amber/40`}>
          <span className="text-sm font-bold text-amber">掲載の申請が {data.pending} 件あります</span>
          <span className="text-xs font-bold text-mist">作品へ ›</span>
        </button>
      )}
      <section className={card}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[0.72rem] text-mist">
              <th className="pb-2 font-bold" />
              <th className="pb-2 text-right font-bold">今日</th>
              <th className="pb-2 text-right font-bold">7日間</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, f]) => (
              <tr key={label} className="border-t border-white/5">
                <td className="py-2 text-paper/90">{label}</td>
                <td className="py-2 text-right font-bold tabular-nums">{f(data.today)}</td>
                <td className="py-2 text-right font-bold tabular-nums">{f(data.week)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className={card}>
        <p className="text-[0.85rem] font-black">よく遊ばれた作品（7日間）</p>
        {data.topPlots.length === 0 ? (
          <p className="mt-2 text-sm text-mist">まだありません</p>
        ) : (
          <ol className="mt-2 space-y-1.5 text-sm">
            {data.topPlots.map((p, i) => (
              <li key={p.plotId} className="flex items-baseline gap-2">
                <span className="w-5 shrink-0 text-right font-bold text-mist">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate">{p.title}</span>
                <span className="shrink-0 text-xs text-mist tabular-nums">
                  {p.users}人・{p.conversations}会話
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function Notes() {
  const { data, error } = useData<{ items: Feedback[] }>("/api/admin/feedback?kind=note");
  const [filter, setFilter] = useState<NoteCategory | "all">("all");
  if (error) return <p className="text-sm text-amber">{error}</p>;
  if (!data) return <p className="text-sm text-mist">読み込み中…</p>;
  const items = data.items.filter((f) => filter === "all" || f.category === filter);
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        <button className={chip(filter === "all")} onClick={() => setFilter("all")}>
          すべて
        </button>
        {(Object.keys(NOTE_CATEGORIES) as NoteCategory[]).map((c) => (
          <button key={c} className={chip(filter === c)} onClick={() => setFilter(c)}>
            {NOTE_CATEGORIES[c]}（{data.items.filter((f) => f.category === c).length}）
          </button>
        ))}
      </div>
      <ul className="mt-3 space-y-2.5">
        {items.length === 0 && <li className="text-sm text-mist">まだありません</li>}
        {items.map((f) => (
          <li key={f.id} className={card}>
            <div className="flex flex-wrap items-center gap-2 text-[0.72rem] text-mist">
              <span className={`rounded-full px-2 py-0.5 font-bold ${f.category === "report" ? "bg-amber/20 text-amber" : "bg-night-3 text-paper/80"}`}>
                {NOTE_CATEGORIES[(f.category ?? "other") as NoteCategory] ?? f.category}
              </span>
              <span>{date(f.createdAt)}</span>
              {f.plotTitle && <span>『{f.plotTitle}』</span>}
              {f.ref && <span>ref: {f.ref}</span>}
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{f.text}</p>
            {f.contact && <p className="mt-1.5 text-xs text-brand">連絡先：{f.contact}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Hearts({ score }: { score: number }) {
  return (
    <span aria-label={`${score} / 5`} className="tracking-tight">
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={i < score ? "text-brand" : "text-mist/30"}>
          ♥
        </span>
      ))}
    </span>
  );
}

function Ratings() {
  const { data, error } = useData<{ items: Feedback[] }>("/api/admin/feedback?kind=rating");
  if (error) return <p className="text-sm text-amber">{error}</p>;
  if (!data) return <p className="text-sm text-mist">読み込み中…</p>;
  const scores = data.items.map((f) => f.score ?? 0).filter(Boolean);
  const avg = scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null;
  return (
    <div>
      <p className="text-sm text-mist">
        直近 {data.items.length} 件{avg !== null && <>・平均 {avg}</>}
      </p>
      <ul className="mt-3 space-y-2.5">
        {data.items.length === 0 && <li className="text-sm text-mist">まだありません</li>}
        {data.items.map((f) => (
          <li key={f.id} className={card}>
            <div className="flex flex-wrap items-center gap-2 text-[0.75rem] text-mist">
              <Hearts score={f.score ?? 0} />
              <span>{date(f.createdAt)}</span>
              {f.plotTitle && <span>『{f.plotTitle}』</span>}
              {f.turns !== null && <span>{f.turns}回話して</span>}
              {f.compare && <span className="rounded-full bg-night-3 px-2 py-0.5 font-bold text-paper/80">{COMPARE[f.compare as Compare] ?? f.compare}</span>}
            </div>
            {f.text && <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{f.text}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}

const WORK_FILTERS = [
  ["pending", "承認待ち"],
  ["public", "掲載中"],
  ["official", "運営の作品"],
  ["private", "リンクだけ"],
  ["removed", "止めた作品"],
  ["all", "すべて"],
] as const;
const STATUS_LABEL: Record<Work["status"], string> = { pending: "承認待ち", public: "掲載中", private: "リンクだけ", removed: "止めた" };

function Works() {
  const [filter, setFilter] = useState<(typeof WORK_FILTERS)[number][0]>("pending");
  const { data, error, reload } = useData<{ items: Work[] }>(`/api/admin/works?filter=${filter}`);
  const [busy, setBusy] = useState<string | null>(null);

  async function act(w: Work, action: string) {
    if (action === "delete" && !window.confirm(`『${w.title}』を削除します。元に戻せません。よろしいですか？`)) return;
    if (action === "remove" && !window.confirm(`『${w.title}』を止めます（リンクでも開けなくなります）。よろしいですか？`)) return;
    setBusy(w.id);
    await api(`/api/admin/works/${w.id}`, { method: "POST", body: JSON.stringify({ action }) });
    setBusy(null);
    reload();
  }

  const btn = "press rounded-full px-3 py-1.5 text-[0.75rem] font-bold disabled:opacity-40";
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {WORK_FILTERS.map(([id, label]) => (
          <button key={id} className={chip(filter === id)} onClick={() => setFilter(id)}>
            {label}
          </button>
        ))}
      </div>
      {error && <p className="mt-3 text-sm text-amber">{error}</p>}
      {!data && !error && <p className="mt-3 text-sm text-mist">読み込み中…</p>}
      <ul className="mt-3 space-y-2.5">
        {data?.items.length === 0 && <li className="text-sm text-mist">ありません</li>}
        {data?.items.map((w) => (
          <li key={w.id} className={`${card} flex gap-3`}>
            <div className="relative aspect-[3/4] w-16 shrink-0 overflow-hidden rounded-lg bg-night-3">
              {w.jacket ? (
                <Image src={w.jacket} alt="" fill sizes="64px" unoptimized className="object-cover" />
              ) : (
                // 絵のジャケットがまだない作品は、題名の頭文字で見分ける
                <span className="bg-brand-grad grid size-full place-items-center text-[1.4rem] font-black text-white/90">{Array.from(w.title)[0]}</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5 text-[0.7rem]">
                <span className="rounded-full bg-night-3 px-2 py-0.5 font-bold text-paper/80">{STATUS_LABEL[w.status]}</span>
                {w.official && <span className="rounded-full bg-brand/20 px-2 py-0.5 font-bold text-brand">運営の作品</span>}
                {w.reports > 0 && <span className="rounded-full bg-amber/20 px-2 py-0.5 font-bold text-amber">通報 {w.reports}</span>}
                <span className="text-mist">{date(w.updatedAt)}</span>
              </div>
              <p className="mt-1 truncate text-[0.95rem] font-black">{w.title}</p>
              <p className="truncate text-xs text-mist">
                作：{w.author}・{w.personas.join("、")}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <a href={`/u/${w.id}`} target="_blank" rel="noopener noreferrer" className={`${btn} bg-night-3`}>
                  見る
                </a>
                <Link href={`/create?id=${w.id}`} className={`${btn} bg-night-3`}>
                  直す
                </Link>
                {(w.status === "pending" || w.status === "private") && (
                  <button disabled={busy === w.id} onClick={() => act(w, "approve")} className={`${btn} btn-brand`}>
                    承認して掲載
                  </button>
                )}
                {(w.status === "pending" || w.status === "public") && (
                  <button disabled={busy === w.id} onClick={() => act(w, "decline")} className={`${btn} bg-night-3`}>
                    載せない
                  </button>
                )}
                {w.status !== "removed" ? (
                  <button disabled={busy === w.id} onClick={() => act(w, "remove")} className={`${btn} bg-night-3 text-amber`}>
                    止める
                  </button>
                ) : (
                  <button disabled={busy === w.id} onClick={() => act(w, "restore")} className={`${btn} bg-night-3`}>
                    戻す
                  </button>
                )}
                <button disabled={busy === w.id} onClick={() => act(w, w.official ? "unofficial" : "official")} className={`${btn} bg-night-3`}>
                  {w.official ? "新作から外す" : "新作に入れる"}
                </button>
                <button disabled={busy === w.id} onClick={() => act(w, "delete")} className={`${btn} text-mist hover:text-red-300`}>
                  削除
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

const PURPOSE_LABEL: Record<string, string> = {
  chat: "会話",
  suggest: "返事の候補",
  summary: "あらすじ",
  ugc_draft: "作品の下書き",
  ugc_assist: "AIで考える",
  ugc_import: "引っ越し",
  ugc_try: "試しに話す",
  x_analyze: "Xの診断",
  other: "その他",
};

function CostView() {
  const [days, setDays] = useState(14);
  const { data, error } = useData<Cost>(`/api/admin/cost?days=${days}`);
  const max = Math.max(1, ...(data?.days.map((d) => d.yen) ?? [1]));
  return (
    <div>
      <div className="flex gap-1.5">
        {[7, 14, 30].map((d) => (
          <button key={d} className={chip(days === d)} onClick={() => setDays(d)}>
            {d}日
          </button>
        ))}
      </div>
      {error && <p className="mt-3 text-sm text-amber">{error}</p>}
      {!data && !error && <p className="mt-3 text-sm text-mist">読み込み中…</p>}
      {data && (
        <div className="mt-3 space-y-4">
          <section className={card}>
            <p className="text-xs text-mist">直近{days}日の文章AIの費用</p>
            <p className="mt-1 text-[1.6rem] font-black tabular-nums">{yen(data.totalYen)}</p>
            <p className="text-xs text-mist">
              呼び出し {data.calls.toLocaleString()} 回{data.unknownCost > 0 && `（うち ${data.unknownCost} 回は単価が分からず 0 円で数えています）`}
            </p>
          </section>
          <section className={card}>
            <p className="text-[0.85rem] font-black">日ごと</p>
            <ul className="mt-2 space-y-1">
              {data.days.map((d) => (
                <li key={d.day} className="grid grid-cols-[3.5rem_1fr_4.5rem] items-center gap-2 text-xs">
                  <span className="text-mist">{d.day.slice(5).replace("-", "/")}</span>
                  <span className="h-2.5 rounded-full bg-night-3">
                    <span className="block h-full rounded-full bg-brand-grad" style={{ width: `${(d.yen / max) * 100}%` }} />
                  </span>
                  <span className="text-right tabular-nums">{yen(d.yen)}</span>
                </li>
              ))}
            </ul>
          </section>
          <section className={card}>
            <p className="text-[0.85rem] font-black">用途ごと</p>
            <table className="mt-2 w-full text-xs">
              <tbody>
                {data.purposes.map((p) => (
                  <tr key={p.purpose} className="border-t border-white/5">
                    <td className="py-1.5">{PURPOSE_LABEL[p.purpose] ?? p.purpose}</td>
                    <td className="py-1.5 text-right tabular-nums text-mist">{p.calls.toLocaleString()}回</td>
                    <td className="py-1.5 text-right font-bold tabular-nums">{yen(p.yen)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      )}
    </div>
  );
}
