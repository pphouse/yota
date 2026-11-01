// 文章AIの原価をまとめる（作者が自分の環境で実行する）。記録は llm_usage（src/lib/llm-usage.ts）。
//   本番のDBを見るとき： DATABASE_URL と DATABASE_AUTH_TOKEN（または TURSO_DATABASE_URL / TURSO_AUTH_TOKEN）を設定して
//   npm run cost -- --days 7
//   npm run cost -- --days 7 --prices '{"qwen-3.8-27b":{"input":0.6,"output":1.2}}'   … 単価を指定して計算し直す（100万トークンあたりの米ドル）
//   npm run cost -- --days 7 --usdjpy 150                                              … 円に直すときのレート（既定 150）
// 結果は Markdown で表示する。ファイルに残すなら > cost.md
import { query } from "../src/lib/db";
import { costOf, parsePrices, type Prices } from "../src/lib/llm-usage";

const args = process.argv.slice(2);
const opt = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const days = Number(opt("days") ?? 0);
const since = days > 0 ? Date.now() - days * 24 * 60 * 60 * 1000 : 0;
const prices: Prices = { ...parsePrices(process.env.LLM_PRICES), ...parsePrices(opt("prices")) };
const usdjpy = Number(opt("usdjpy") ?? 150);
const repriced = Boolean(opt("prices"));

type Row = {
  session_id: string | null;
  purpose: string;
  model: string;
  effort: string;
  input_tokens: number | null;
  cached_tokens: number | null;
  output_tokens: number | null;
  reasoning_tokens: number | null;
  reasoning_chars: number;
  output_chars: number;
  cost_usd: number | null;
  ms: number;
  status: string;
  created_at: number;
};

const rows = await query<Row>(
  `SELECT session_id, purpose, model, effort, input_tokens, cached_tokens, output_tokens, reasoning_tokens,
          reasoning_chars, output_chars, cost_usd, ms, status, created_at
   FROM llm_usage WHERE created_at >= ? AND model <> 'mock'`,
  [since],
);

const n = (v: number | null | undefined) => Number(v ?? 0);
const costUsd = (r: Row): number | null => {
  if (!repriced && r.cost_usd != null) return Number(r.cost_usd);
  return costOf(prices[r.model], { inputTokens: r.input_tokens, cachedTokens: r.cached_tokens, outputTokens: r.output_tokens });
};
const yen = (usd: number) => `${(usd * usdjpy).toLocaleString("ja-JP", { maximumFractionDigits: usd * usdjpy < 10 ? 2 : 0 })}円`;
const int = (v: number) => Math.round(v).toLocaleString("ja-JP");
const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : "-");
const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};
const quantile = (xs: number[], q: number) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * q))];
};

const out: string[] = [`# yota の文章AIの原価（${days > 0 ? `直近${days}日` : "全期間"}）`, ""];
if (!rows.length) {
  out.push("まだ記録がありません（ダミー応答の記録は数えません）。");
  console.log(out.join("\n"));
  process.exit(0);
}

const priced = rows.filter((r) => costUsd(r) != null);
const missingModels = [...new Set(rows.filter((r) => costUsd(r) == null && r.input_tokens != null).map((r) => r.model))];
const noTokens = rows.filter((r) => r.input_tokens == null).length;
const totalUsd = priced.reduce((s, r) => s + (costUsd(r) ?? 0), 0);

out.push(`- 呼び出し：${int(rows.length)}回（トークン数が分からないもの ${int(noTokens)}回：途中で止めた・失敗など）`);
out.push(`- 原価：${priced.length ? `${yen(totalUsd)}（$${totalUsd.toFixed(4)}、1ドル=${usdjpy}円）` : "単価が分からないため計算できません（--prices で指定）"}`);
if (missingModels.length) out.push(`- 単価がないモデル：${missingModels.join("、")}（--prices で指定すると計算に入ります）`);
out.push("");

// 用途ごと
out.push("## 用途ごと", "");
out.push("| 用途 | 回数 | 入力（平均） | うちキャッシュ | 出力（平均） | うち推論 | 推論の文字数（平均） | 時間（中央値） | 止めた・失敗 | 原価 | 原価の割合 |");
out.push("|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|");
const purposes = [...new Set(rows.map((r) => r.purpose))];
const byPurpose = purposes
  .map((p) => {
    const rs = rows.filter((r) => r.purpose === p);
    const known = rs.filter((r) => r.input_tokens != null);
    const usd = rs.reduce((s, r) => s + (costUsd(r) ?? 0), 0);
    return { p, rs, known, usd };
  })
  .sort((a, b) => b.usd - a.usd || b.rs.length - a.rs.length);
for (const { p, rs, known, usd } of byPurpose) {
  const avg = (f: (r: Row) => number) => (known.length ? known.reduce((s, r) => s + f(r), 0) / known.length : 0);
  const reasoningKnown = known.filter((r) => r.reasoning_tokens != null);
  const outSum = reasoningKnown.reduce((s, r) => s + n(r.output_tokens), 0);
  const reasonSum = reasoningKnown.reduce((s, r) => s + n(r.reasoning_tokens), 0);
  const bad = rs.filter((r) => r.status !== "ok").length;
  out.push(
    `| ${p} | ${int(rs.length)} | ${int(avg((r) => n(r.input_tokens)))} | ${int(avg((r) => n(r.cached_tokens)))} | ${int(avg((r) => n(r.output_tokens)))} | ${reasoningKnown.length ? pct(reasonSum, outSum) : "不明"} | ${int(rs.reduce((s, r) => s + n(r.reasoning_chars), 0) / rs.length)} | ${(median(rs.map((r) => n(r.ms))) / 1000).toFixed(1)}秒 | ${pct(bad, rs.length)} | ${priced.length ? yen(usd) : "-"} | ${pct(usd, totalUsd)} |`,
  );
}
out.push("");
out.push("「うち推論」は、出力のトークンのうち考えた分の割合です（API が内訳を返したときだけ）。返さない API では、推論の文字数を目安にしてください。");
out.push("");

// 1往復あたり
const chats = rows.filter((r) => r.purpose === "chat").length;
if (chats && priced.length) {
  const perTurn = rows.filter((r) => ["chat", "suggest", "summary"].includes(r.purpose)).reduce((s, r) => s + (costUsd(r) ?? 0), 0) / chats;
  out.push("## 会話1往復あたり", "");
  out.push(`- 返答・返事の候補・あらすじを合わせて、1往復あたり **${yen(perTurn)}**（返答 ${int(chats)} 回で割った値）`);
  out.push("");
}

// モデル・考える量ごと
out.push("## モデルと考える量ごと", "");
out.push("| モデル | 考える量 | 回数 | 出力（平均） | 原価 |");
out.push("|---|---|---:|---:|---:|");
const combos = [...new Set(rows.map((r) => `${r.model}\t${r.effort}`))];
for (const c of combos) {
  const [model, effort] = c.split("\t");
  const rs = rows.filter((r) => r.model === model && r.effort === effort);
  const known = rs.filter((r) => r.output_tokens != null);
  const usd = rs.reduce((s, r) => s + (costUsd(r) ?? 0), 0);
  out.push(`| ${model || "（不明）"} | ${effort || "なし"} | ${int(rs.length)} | ${int(known.length ? known.reduce((s, r) => s + n(r.output_tokens), 0) / known.length : 0)} | ${priced.length ? yen(usd) : "-"} |`);
}
out.push("");

// ユーザーごと（1日あたり）
if (priced.length) {
  const perDay = new Map<string, number>();
  for (const r of rows) {
    if (!r.session_id) continue;
    const day = new Date(Number(r.created_at) + 9 * 3600 * 1000).toISOString().slice(0, 10);
    const key = `${r.session_id}\t${day}`;
    perDay.set(key, (perDay.get(key) ?? 0) + (costUsd(r) ?? 0));
  }
  const vals = [...perDay.values()];
  const perSession = new Map<string, number>();
  for (const [key, v] of perDay) {
    const sid = key.split("\t")[0];
    perSession.set(sid, (perSession.get(sid) ?? 0) + v);
  }
  const sessions = [...perSession.entries()].sort((a, b) => b[1] - a[1]);
  const top = sessions.slice(0, Math.max(1, Math.ceil(sessions.length * 0.1)));
  const topUsd = top.reduce((s, [, v]) => s + v, 0);
  const allUsd = sessions.reduce((s, [, v]) => s + v, 0);
  out.push("## ユーザーごと", "");
  out.push(`- 使った人：${int(sessions.length)}人`);
  out.push(`- 1人1日あたりの原価：中央値 ${yen(median(vals))}、上位10% ${yen(quantile(vals, 0.9))}、最大 ${yen(Math.max(...vals))}`);
  out.push(`- よく使う上位10%（${top.length}人）が、原価全体の ${pct(topUsd, allUsd)} を使っている`);
  out.push("");
  out.push("| ユーザー（IDの先頭） | 期間の原価 |");
  out.push("|---|---:|");
  for (const [sid, v] of sessions.slice(0, 10)) out.push(`| ${sid.slice(0, 8)} | ${yen(v)} |`);
  out.push("");
}

console.log(out.join("\n"));
