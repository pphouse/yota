import { createClient, type Client, type InValue } from "@libsql/client";
import { mkdirSync } from "node:fs";
import path from "node:path";

/**
 * 開発中はローカルのSQLiteファイル、本番は DATABASE_URL（Tursoなど libSQL 互換）を使う。
 * Vercel の Marketplace で入れた Turso は TURSO_DATABASE_URL / TURSO_AUTH_TOKEN という名前で入るので、それも読む。
 */
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    birth_year INTEGER NOT NULL,
    birth_month INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    plot_id TEXT NOT NULL,
    viewpoint TEXT NOT NULL,
    summary TEXT NOT NULL DEFAULT '',
    summarized_count INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_conv_session ON conversations(session_id, plot_id, viewpoint, updated_at)`,
  `CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    seq INTEGER NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    flagged INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_msg_conv ON messages(conversation_id, seq)`,
  `CREATE TABLE IF NOT EXISTS usage (
    session_id TEXT NOT NULL,
    day TEXT NOT NULL,
    active_seconds INTEGER NOT NULL DEFAULT 0,
    last_at INTEGER NOT NULL,
    PRIMARY KEY (session_id, day)
  )`,
  `CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT,
    type TEXT NOT NULL,
    props TEXT NOT NULL DEFAULT '{}',
    created_at INTEGER NOT NULL
  )`,
  // ユーザーからの声。rating は会話のあとのひとこと評価、note はホームから送るご意見
  `CREATE TABLE IF NOT EXISTS feedback (
    id TEXT PRIMARY KEY,
    session_id TEXT,
    kind TEXT NOT NULL,
    plot_id TEXT,
    conversation_id TEXT,
    score INTEGER,
    compare TEXT,
    category TEXT,
    text TEXT NOT NULL DEFAULT '',
    contact TEXT NOT NULL DEFAULT '',
    turns INTEGER,
    ref TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback(created_at)`,
  // ユーザーが作った作品。data は作品の中身（JSON）、jacket はジャケットの画像（webp）
  `CREATE TABLE IF NOT EXISTS user_plots (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    author TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'private',
    data TEXT NOT NULL,
    jacket BLOB,
    jacket_status TEXT NOT NULL DEFAULT 'none',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_user_plots_status ON user_plots(status, updated_at)`,
  `CREATE INDEX IF NOT EXISTS idx_user_plots_session ON user_plots(session_id, updated_at)`,
];

// あとから足した列。作成済みのDBにも足す（すでにあればエラーになるので無視する）
const MIGRATIONS = [
  `ALTER TABLE sessions ADD COLUMN name TEXT NOT NULL DEFAULT ''`,
  // どこから来た人か（募集の投稿のリンクに付けた ?ref=）
  `ALTER TABLE sessions ADD COLUMN ref TEXT NOT NULL DEFAULT ''`,
];

let client: Client | undefined;
let ready: Promise<void> | undefined;

function getClient(): Client {
  if (client) return client;
  const url = process.env.DATABASE_URL ?? process.env.TURSO_DATABASE_URL ?? "file:data/yota.db";
  if (url.startsWith("file:")) {
    const file = url.slice("file:".length);
    if (file !== ":memory:") mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  }
  client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN ?? process.env.TURSO_AUTH_TOKEN });
  return client;
}

export async function db(): Promise<Client> {
  const c = getClient();
  ready ??= (async () => {
    for (const stmt of SCHEMA) await c.execute(stmt);
    for (const stmt of MIGRATIONS) await c.execute(stmt).catch(() => {});
  })();
  await ready;
  return c;
}

export async function query<T>(sql: string, args: InValue[] = []): Promise<T[]> {
  const res = await (await db()).execute({ sql, args });
  return res.rows as unknown as T[];
}

export async function run(sql: string, args: InValue[] = []): Promise<void> {
  await (await db()).execute({ sql, args });
}

/** テスト用：別のDBに切り替える */
export function resetDbForTests(url: string) {
  process.env.DATABASE_URL = url;
  client = undefined;
  ready = undefined;
}
