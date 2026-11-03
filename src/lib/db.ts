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
  // 「Xから生まれる彼」の結果。投稿とトークンは保存せず、作ったもの（タイプ・ツッコミ・彼の作品のID）だけを残す。
  // x_user は X のユーザーIDのハッシュ（同じ人が続けて診断したとき、投稿を読み直さずに前の結果を出すため）
  `CREATE TABLE IF NOT EXISTS x_results (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    x_user TEXT NOT NULL,
    handle TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'working',
    data TEXT NOT NULL DEFAULT '{}',
    error TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_x_results_user ON x_results(x_user, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_x_results_created ON x_results(created_at)`,
  // ログイン（LINE・Google・Apple）。外部のアカウントの ID はハッシュにして持ち、セッション（匿名のアカウント）に結びつける
  `CREATE TABLE IF NOT EXISTS identities (
    provider TEXT NOT NULL,
    subject TEXT NOT NULL,
    session_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    last_login_at INTEGER NOT NULL,
    PRIMARY KEY (provider, subject)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_identities_session ON identities(session_id)`,
  // メールでのログインのコード。メールアドレスとコードはハッシュで持ち、1日たったら消す
  `CREATE TABLE IF NOT EXISTS email_codes (
    id TEXT PRIMARY KEY,
    email_hash TEXT NOT NULL,
    code_hash TEXT NOT NULL,
    ip TEXT NOT NULL,
    tries INTEGER NOT NULL DEFAULT 0,
    used INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_email_codes_email ON email_codes(email_hash, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_email_codes_ip ON email_codes(ip, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_email_codes_created ON email_codes(created_at)`,
  // 作品のキャラに登録した画像（正方形の小さい絵。作る画面で切り抜いてから送る）
  `CREATE TABLE IF NOT EXISTS ugc_images (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    mime TEXT NOT NULL,
    data BLOB NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  // アプリの通知を送る先（端末ごとのトークン）。token は端末とアプリの組み合わせで1つ
  `CREATE TABLE IF NOT EXISTS push_tokens (
    token TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    platform TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_push_session ON push_tokens(session_id)`,
  // 作者のブロック。ブロックした人には、その作者の作品を「みんなの作品」に出さない。
  // 作者のセッションIDは画面に出さず、id（ランダム）で解除する
  `CREATE TABLE IF NOT EXISTS blocks (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    author_session_id TEXT NOT NULL,
    author TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    UNIQUE (session_id, author_session_id)
  )`,
  // 文章AIの呼び出し1回ごとの記録（原価を測るため）。会話の中身は残さない。
  // トークン数が分からない呼び出し（途中で止めた等）は NULL のまま、文字数だけ残す
  `CREATE TABLE IF NOT EXISTS llm_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT,
    purpose TEXT NOT NULL,
    provider TEXT NOT NULL,
    model TEXT NOT NULL DEFAULT '',
    tier TEXT NOT NULL DEFAULT '',
    effort TEXT NOT NULL DEFAULT '',
    input_tokens INTEGER,
    cached_tokens INTEGER,
    output_tokens INTEGER,
    reasoning_tokens INTEGER,
    reasoning_chars INTEGER NOT NULL DEFAULT 0,
    output_chars INTEGER NOT NULL DEFAULT 0,
    cost_usd REAL,
    ms INTEGER NOT NULL,
    status TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_llm_usage_created ON llm_usage(created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_llm_usage_session ON llm_usage(session_id, created_at)`,
];

// あとから足した列。作成済みのDBにも足す（すでにあればエラーになるので無視する）
const MIGRATIONS = [
  `ALTER TABLE sessions ADD COLUMN name TEXT NOT NULL DEFAULT ''`,
  // どこから来た人か（募集の投稿のリンクに付けた ?ref=）
  `ALTER TABLE sessions ADD COLUMN ref TEXT NOT NULL DEFAULT ''`,
  // 運営が管理者画面から作った作品（ホームの「新作」に出す）。ユーザーの作品を運営が選んで入れることもできる
  `ALTER TABLE user_plots ADD COLUMN official INTEGER NOT NULL DEFAULT 0`,
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
