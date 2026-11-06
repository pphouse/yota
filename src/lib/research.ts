/**
 * 運営の調査データ（サーバー専用）。管理者だけが上げて、見られる。
 * 形は screenpilot の調査（examples/x_zeta_explore.py）が書き出す JSON と同じ：
 *   { generated_at, total_posts, total_views, accounts: [{ handle, name, category, tone, posts: [...] , ...}], ... }
 * ビューワー（research-viewer.ts）にそのまま渡す。
 */
import { z } from "zod";
import { query, run } from "./db";

/** 上げられる大きさ（Vercel の関数が受け取れる 4.5MB より少し小さく） */
export const RESEARCH_MAX_BYTES = 4_000_000;

const Post = z.object({ url: z.string(), text: z.string(), views: z.number().optional() }).passthrough();
const Account = z.object({ handle: z.string().min(1), name: z.string().optional(), posts: z.array(Post) }).passthrough();
export const ResearchData = z
  .object({ generated_at: z.string().optional(), total_posts: z.number().optional(), total_views: z.number().optional(), accounts: z.array(Account).min(1) })
  .passthrough();
export type ResearchData = z.infer<typeof ResearchData>;

export type DatasetMeta = { id: string; title: string; accounts: number; posts: number; views: number; collectedAt: string; createdAt: number };

type Row = { id: string; title: string; accounts: number; posts: number; views: number; collected_at: string; created_at: number };
const toMeta = (r: Row): DatasetMeta => ({
  id: r.id,
  title: r.title,
  accounts: Number(r.accounts),
  posts: Number(r.posts),
  views: Number(r.views),
  collectedAt: r.collected_at,
  createdAt: Number(r.created_at),
});

/** これより小さい埋め込みアイコン（data:）はそのまま残す。TikTok のアイコンの URL は時間がたつと切れるため */
export const SMALL_AVATAR_CHARS = 8_000;

/**
 * 保存する前に、ビューワーで使わない大きな項目を落とす。
 * 大きく埋め込んだアイコン画像（data:）は、アイコンの URL（avatar_url）に置きかえる。小さいものは残す。
 */
export function slim(data: ResearchData): ResearchData {
  return {
    ...data,
    accounts: data.accounts.map((a) => {
      const own = typeof a.avatar === "string" ? a.avatar : null;
      const keep = own && (!own.startsWith("data:") || own.length <= SMALL_AVATAR_CHARS);
      const avatar = keep ? own : typeof a.avatar_url === "string" ? a.avatar_url : null;
      return { ...a, avatar };
    }),
  };
}

export async function saveDataset(title: string, raw: ResearchData): Promise<DatasetMeta> {
  const data = slim(raw);
  const posts = data.accounts.reduce((n, a) => n + a.posts.length, 0);
  const views = data.total_views ?? data.accounts.reduce((n, a) => n + a.posts.reduce((m, p) => m + (p.views ?? 0), 0), 0);
  const meta: DatasetMeta = {
    id: crypto.randomUUID(),
    title,
    accounts: data.accounts.length,
    posts,
    views,
    collectedAt: data.generated_at ?? "",
    createdAt: Date.now(),
  };
  await run(
    "INSERT INTO research_datasets (id, title, accounts, posts, views, collected_at, data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [meta.id, meta.title, meta.accounts, meta.posts, meta.views, meta.collectedAt, JSON.stringify(data), meta.createdAt],
  );
  return meta;
}

export async function listDatasets(): Promise<DatasetMeta[]> {
  const rows = await query<Row>("SELECT id, title, accounts, posts, views, collected_at, created_at FROM research_datasets ORDER BY created_at DESC");
  return rows.map(toMeta);
}

/** ビューワーに渡す JSON の文字列（読み直さずにそのまま埋め込む） */
export async function getDatasetJson(id: string): Promise<{ meta: DatasetMeta; json: string } | null> {
  const rows = await query<Row & { data: string }>("SELECT id, title, accounts, posts, views, collected_at, created_at, data FROM research_datasets WHERE id = ?", [id]);
  return rows[0] ? { meta: toMeta(rows[0]), json: rows[0].data } : null;
}

export async function deleteDataset(id: string): Promise<void> {
  await run("DELETE FROM research_datasets WHERE id = ?", [id]);
}
