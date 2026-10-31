// ユーザーの声と、流入元ごとの遊ばれ方をまとめる（作者が自分の環境で実行する）。
//   本番のDBを見るとき： DATABASE_URL と DATABASE_AUTH_TOKEN（または TURSO_DATABASE_URL / TURSO_AUTH_TOKEN）を設定して
//   npm run feedback -- --days 14            … 直近14日（省くと全期間）
//   npm run feedback -- --days 14 --ref zeta-x   … 流入元を絞る
// 結果は Markdown で表示する。ファイルに残すなら > feedback.md
import { query } from "../src/lib/db";
import { getPlot } from "../src/lib/characters";
import { COMPARE, NOTE_CATEGORIES, type Compare, type NoteCategory } from "../src/lib/feedback";

const args = process.argv.slice(2);
const opt = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const days = Number(opt("days") ?? 0);
const since = days > 0 ? Date.now() - days * 24 * 60 * 60 * 1000 : 0;
const refFilter = opt("ref");
const title = (id: string | null) => (id ? (getPlot(id)?.title ?? id) : "（作品なし）");
const date = (t: number) => new Date(Number(t)).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
const label = (ref: string) => ref || "（なし）";

const out: string[] = [`# yota のフィードバック（${days > 0 ? `直近${days}日` : "全期間"}${refFilter ? `・流入元 ${refFilter}` : ""}）`, ""];

// 流入元ごとの人数：年齢確認をした → 会話を始めた（1回以上送った）→ 6回以上送った
const funnel = await query<{ ref: string; sessions: number; started: number; engaged: number }>(
  `WITH turns AS (
     SELECT c.session_id, c.id, COUNT(m.id) AS n
     FROM conversations c JOIN messages m ON m.conversation_id = c.id AND m.role = 'user'
     GROUP BY c.id
   ), per AS (
     SELECT session_id, MAX(n) AS best FROM turns GROUP BY session_id
   )
   SELECT s.ref AS ref, COUNT(*) AS sessions,
          SUM(CASE WHEN per.best >= 1 THEN 1 ELSE 0 END) AS started,
          SUM(CASE WHEN per.best >= 6 THEN 1 ELSE 0 END) AS engaged
   FROM sessions s LEFT JOIN per ON per.session_id = s.id
   WHERE s.created_at >= ? ${refFilter ? "AND s.ref = ?" : ""}
   GROUP BY s.ref ORDER BY sessions DESC`,
  refFilter ? [since, refFilter] : [since],
);
const landings = await query<{ props: string }>(`SELECT props FROM events WHERE type = 'landing_view' AND created_at >= ?`, [since]);
const landed = new Map<string, number>();
for (const l of landings) {
  const ref = String(JSON.parse(l.props || "{}").ref ?? "");
  landed.set(ref, (landed.get(ref) ?? 0) + 1);
}
out.push("## 流入元ごとの人数", "", "| 流入元 | リンクを開いた | 年齢確認をした | 会話を始めた | 6回以上話した |", "|---|---|---|---|---|");
for (const f of funnel) {
  out.push(`| ${label(f.ref)} | ${f.ref ? (landed.get(f.ref) ?? 0) : "—"} | ${f.sessions} | ${Number(f.started)} | ${Number(f.engaged)} |`);
}
out.push("");

const where = `f.created_at >= ?${refFilter ? " AND f.ref = ?" : ""}`;
const params = refFilter ? [since, refFilter] : [since];

// 会話のあとのひとこと評価
const ratings = await query<{ plot_id: string; score: number; compare: string | null; text: string; turns: number; ref: string; created_at: number }>(
  `SELECT plot_id, score, compare, text, turns, ref, created_at FROM feedback f WHERE kind = 'rating' AND ${where} ORDER BY created_at DESC`,
  params,
);
out.push(`## 会話のあとの評価（${ratings.length}件）`, "");
if (ratings.length) {
  const avg = (xs: number[]) => (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(2);
  out.push(`平均 **${avg(ratings.map((r) => Number(r.score)))}**（5が最高）`, "", "| 作品 | 件数 | 平均 |", "|---|---|---|");
  const byPlot = new Map<string, number[]>();
  for (const r of ratings) byPlot.set(r.plot_id, [...(byPlot.get(r.plot_id) ?? []), Number(r.score)]);
  for (const [id, scores] of [...byPlot].sort((a, b) => b[1].length - a[1].length)) out.push(`| ${title(id)} | ${scores.length} | ${avg(scores)} |`);
  out.push("", "**ほかのキャラチャットアプリと比べて**", "");
  for (const c of Object.keys(COMPARE) as Compare[]) out.push(`- ${COMPARE[c]}：${ratings.filter((r) => r.compare === c).length}件`);
  out.push(`- 答えなし：${ratings.filter((r) => !r.compare).length}件`, "", "**ひとこと**", "");
  for (const r of ratings.filter((r) => r.text)) {
    out.push(`- ${"★".repeat(Number(r.score))}　${r.text.replace(/\n/g, " ")}（${title(r.plot_id)}、${r.turns}回話して、${label(r.ref)}、${date(r.created_at)}）`);
  }
}
out.push("");

// ご意見
const notes = await query<{ category: NoteCategory; text: string; contact: string; ref: string; created_at: number }>(
  `SELECT category, text, contact, ref, created_at FROM feedback f WHERE kind = 'note' AND ${where} ORDER BY created_at DESC`,
  params,
);
out.push(`## ご意見（${notes.length}件）`, "");
for (const n of notes) {
  out.push(`- 【${NOTE_CATEGORIES[n.category] ?? n.category}】${n.text.replace(/\n/g, " ")}${n.contact ? `（連絡先：${n.contact}）` : ""}（${label(n.ref)}、${date(n.created_at)}）`);
}

console.log(out.join("\n"));
