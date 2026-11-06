/**
 * 管理者画面に出す数字と一覧（サーバー専用）。運営用のスクリプト（npm run feedback / ugc / cost）と同じデータを、画面向けにまとめる。
 */
import { getPlot } from "./characters";
import { query } from "./db";
import { costOf, parsePrices } from "./llm-usage";
import { splitRef } from "./ref";
import { getUgc, listUgc, type UgcStatus } from "./ugc";

const DAY = 24 * 60 * 60 * 1000;
const JST = 9 * 60 * 60 * 1000;
/** 日本時間の今日の0時 */
export const startOfTodayJst = (now = Date.now()) => Math.floor((now + JST) / DAY) * DAY - JST;
/** 円に直すときのレート（環境変数 USDJPY で変えられる） */
const usdjpy = () => Number(process.env.USDJPY ?? 150);

const num = async (sql: string, args: (string | number)[] = []) => Number((await query<{ n: number | null }>(sql, args))[0]?.n ?? 0);

export type Period = { newUsers: number; activeUsers: number; conversations: number; messages: number; ratings: number; ratingAvg: number | null; notes: number; reports: number; works: number; xDiagnoses: number; costYen: number };

async function period(since: number): Promise<Period> {
  const [newUsers, activeUsers, conversations, messages, ratings, ratingAvg, notes, reports, works, xDiagnoses, costUsd] = await Promise.all([
    num("SELECT COUNT(*) AS n FROM sessions WHERE created_at >= ?", [since]),
    num("SELECT COUNT(DISTINCT c.session_id) AS n FROM messages m JOIN conversations c ON c.id = m.conversation_id WHERE m.role = 'user' AND m.created_at >= ?", [since]),
    num("SELECT COUNT(*) AS n FROM conversations WHERE created_at >= ?", [since]),
    num("SELECT COUNT(*) AS n FROM messages WHERE role = 'user' AND created_at >= ?", [since]),
    num("SELECT COUNT(*) AS n FROM feedback WHERE kind = 'rating' AND created_at >= ?", [since]),
    num("SELECT AVG(score) AS n FROM feedback WHERE kind = 'rating' AND created_at >= ?", [since]),
    num("SELECT COUNT(*) AS n FROM feedback WHERE kind = 'note' AND COALESCE(category, '') <> 'report' AND created_at >= ?", [since]),
    num("SELECT COUNT(*) AS n FROM feedback WHERE kind = 'note' AND category = 'report' AND created_at >= ?", [since]),
    num("SELECT COUNT(*) AS n FROM user_plots WHERE created_at >= ?", [since]),
    num("SELECT COUNT(*) AS n FROM x_results WHERE created_at >= ?", [since]),
    num("SELECT SUM(cost_usd) AS n FROM llm_usage WHERE model <> 'mock' AND created_at >= ?", [since]),
  ]);
  return { newUsers, activeUsers, conversations, messages, ratings, ratingAvg: ratings ? Math.round(ratingAvg * 10) / 10 : null, notes, reports, works, xDiagnoses, costYen: Math.round(costUsd * usdjpy()) };
}

/** 作品のIDから題名（こちらの作品でもユーザーの作品でも） */
async function titleOf(plotId: string): Promise<string> {
  return getPlot(plotId)?.title ?? (await getUgc(plotId))?.plot.title ?? plotId;
}

export async function stats(now = Date.now()) {
  const today = startOfTodayJst(now);
  const [day, week, pending, top] = await Promise.all([
    period(today),
    period(now - 7 * DAY),
    num("SELECT COUNT(*) AS n FROM user_plots WHERE status = 'pending'"),
    query<{ plot_id: string; conversations: number; users: number }>(
      "SELECT plot_id, COUNT(*) AS conversations, COUNT(DISTINCT session_id) AS users FROM conversations WHERE created_at >= ? GROUP BY plot_id ORDER BY users DESC, conversations DESC LIMIT 10",
      [now - 7 * DAY],
    ),
  ]);
  const topPlots = await Promise.all(top.map(async (r) => ({ plotId: r.plot_id, title: await titleOf(r.plot_id), users: Number(r.users), conversations: Number(r.conversations) })));
  return { today: day, week, pending, topPlots };
}

export type FeedbackItem = {
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

export async function feedbackList(kind: "note" | "rating", limit = 100): Promise<FeedbackItem[]> {
  const rows = await query<{
    id: string;
    kind: "note" | "rating";
    category: string | null;
    score: number | null;
    compare: string | null;
    text: string;
    contact: string;
    plot_id: string | null;
    turns: number | null;
    ref: string;
    created_at: number;
  }>("SELECT id, kind, category, score, compare, text, contact, plot_id, turns, ref, created_at FROM feedback WHERE kind = ? ORDER BY created_at DESC LIMIT ?", [kind, limit]);
  const titles = new Map<string, string>();
  for (const r of rows) if (r.plot_id && !titles.has(r.plot_id)) titles.set(r.plot_id, await titleOf(r.plot_id));
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    category: r.category,
    score: r.score === null ? null : Number(r.score),
    compare: r.compare,
    text: r.text,
    contact: r.contact,
    plotId: r.plot_id,
    plotTitle: r.plot_id ? (titles.get(r.plot_id) ?? null) : null,
    turns: r.turns === null ? null : Number(r.turns),
    ref: r.ref,
    createdAt: Number(r.created_at),
  }));
}

/** 管理者画面の作品の一覧。通報の数も添える（通報の本文に作品のIDが入っている） */
export async function worksList(filter: UgcStatus | "official" | "all", limit = 100) {
  const items =
    filter === "official" ? await listUgc({ official: true, status: "any" }, limit) : await listUgc({ status: filter === "all" ? "any" : filter }, limit);
  const reports = await query<{ text: string }>("SELECT text FROM feedback WHERE kind = 'note' AND category = 'report' AND text LIKE '%u-%'");
  return items.map(({ plot, meta }) => ({
    id: meta.id,
    title: plot.title,
    catchphrase: plot.catchphrase,
    author: meta.author,
    status: meta.status,
    official: meta.official,
    jacket: plot.jacket ?? null,
    personas: plot.personas.map((p) => p.name),
    reports: reports.filter((r) => r.text.includes(meta.id)).length,
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt,
  }));
}

/** 文章AIの費用（日ごと・用途ごと）。記録に費用がなければ LLM_PRICES の単価で計算する */
export async function costSummary(days = 14, now = Date.now()) {
  const since = startOfTodayJst(now) - (days - 1) * DAY;
  const rows = await query<{ purpose: string; model: string; input_tokens: number | null; cached_tokens: number | null; output_tokens: number | null; cost_usd: number | null; created_at: number }>(
    "SELECT purpose, model, input_tokens, cached_tokens, output_tokens, cost_usd, created_at FROM llm_usage WHERE model <> 'mock' AND created_at >= ?",
    [since],
  );
  const prices = parsePrices(process.env.LLM_PRICES);
  const rate = usdjpy();
  const byDay = new Map<string, { calls: number; yen: number }>();
  const byPurpose = new Map<string, { calls: number; yen: number; input: number; output: number }>();
  let unknown = 0;
  for (const r of rows) {
    const usd = r.cost_usd != null ? Number(r.cost_usd) : costOf(prices[r.model], { inputTokens: r.input_tokens, cachedTokens: r.cached_tokens, outputTokens: r.output_tokens });
    if (usd == null) unknown++;
    const yen = (usd ?? 0) * rate;
    const day = new Date(Number(r.created_at) + JST).toISOString().slice(0, 10);
    const d = byDay.get(day) ?? { calls: 0, yen: 0 };
    d.calls++;
    d.yen += yen;
    byDay.set(day, d);
    const p = byPurpose.get(r.purpose) ?? { calls: 0, yen: 0, input: 0, output: 0 };
    p.calls++;
    p.yen += yen;
    p.input += Number(r.input_tokens ?? 0);
    p.output += Number(r.output_tokens ?? 0);
    byPurpose.set(r.purpose, p);
  }
  const days_ = Array.from({ length: days }, (_, i) => new Date(since + i * DAY + JST).toISOString().slice(0, 10)).map((day) => ({
    day,
    calls: byDay.get(day)?.calls ?? 0,
    yen: Math.round(byDay.get(day)?.yen ?? 0),
  }));
  return {
    totalYen: Math.round(days_.reduce((s, d) => s + d.yen, 0)),
    calls: rows.length,
    unknownCost: unknown,
    days: days_,
    purposes: [...byPurpose.entries()].map(([purpose, v]) => ({ purpose, calls: v.calls, yen: Math.round(v.yen), input: v.input, output: v.output })).sort((a, b) => b.yen - a.yen),
  };
}

export type SourceRow = { key: string; visits: number; starts: number; talked: number };

/**
 * どこから来た人か（入口：Google 検索・ChatGPT・Claude など／リンク：?ref= の記事のボタンや TikTok のプロフィールなど）。
 * - visits：その入口・リンクから初めて来た端末の数（landing_view）
 * - starts：名前と年齢を入れて遊び始めた人（sessions.ref）
 * - talked：そのうち、実際にキャラと話した人（conversations がある）
 */
export async function sourcesSummary(days = 14, now = Date.now()) {
  const since = startOfTodayJst(now) - (days - 1) * DAY;
  const views = await query<{ props: string }>("SELECT props FROM events WHERE type = 'landing_view' AND created_at >= ?", [since]);
  const sessions = await query<{ ref: string | null; talked: number }>(
    "SELECT s.ref AS ref, CASE WHEN EXISTS (SELECT 1 FROM conversations c WHERE c.session_id = s.id) THEN 1 ELSE 0 END AS talked FROM sessions s WHERE s.created_at >= ?",
    [since],
  );
  const bySrc = new Map<string, SourceRow>();
  const byLink = new Map<string, SourceRow>();
  const row = (m: Map<string, SourceRow>, key: string) => {
    let r = m.get(key);
    if (!r) m.set(key, (r = { key, visits: 0, starts: 0, talked: 0 }));
    return r;
  };
  for (const v of views) {
    let p: { src?: unknown; ref?: unknown } = {};
    try {
      p = JSON.parse(v.props);
    } catch {}
    if (typeof p.src === "string" && p.src) row(bySrc, p.src).visits++;
    if (typeof p.ref === "string" && p.ref) row(byLink, p.ref).visits++;
  }
  for (const s of sessions) {
    const { src, link } = splitRef(s.ref ?? "");
    const a = row(bySrc, src);
    a.starts++;
    a.talked += Number(s.talked) ? 1 : 0;
    if (link) {
      const b = row(byLink, link);
      b.starts++;
      b.talked += Number(s.talked) ? 1 : 0;
    }
  }
  const sort = (m: Map<string, SourceRow>) => [...m.values()].sort((a, b) => b.starts - a.starts || b.visits - a.visits);
  return { days, starts: sessions.length, sources: sort(bySrc), links: sort(byLink) };
}
