/**
 * X（旧Twitter）の API（サーバー専用）。「Xから生まれる彼」で、ログインした本人のプロフィールと最近の投稿を読む。
 * OAuth 2.0（PKCE）でログインしてもらい、読むのは本人のデータだけ。アクセストークンと投稿は保存しない。
 * 料金は従量課金：ユーザー1件 $0.010・投稿1件 $0.005（1回の診断で約 $0.51）。
 */

export type XConfig = { clientId: string; clientSecret?: string; redirectUri?: string; mock: boolean };

type Env = Record<string, string | undefined>;

/** X のキーが設定されていれば設定を返す。X_MOCK は本番以外で、キーなしに画面を試すためのもの */
export function xConfig(env: Env = process.env): XConfig | null {
  const mock = env.X_MOCK === "1" && env.VERCEL_ENV !== "production";
  if (mock) return { clientId: "mock", mock: true };
  if (!env.X_CLIENT_ID) return null;
  return { clientId: env.X_CLIENT_ID, clientSecret: env.X_CLIENT_SECRET || undefined, redirectUri: env.X_REDIRECT_URI || undefined, mock: false };
}

export const X_SCOPES = "tweet.read users.read";
export const POST_COUNT = 100;

/** ログインの途中で、state と PKCE の verifier を置く cookie */
export const X_COOKIE = "yota_x";
/** 1日に診断できる回数（1人）と、全体の上限（X API の費用を抑える。1回およそ $0.51） */
export const X_PER_SESSION = 2;
export const xDailyLimit = (env: Env = process.env) => Number(env.X_DAILY_LIMIT ?? 200);

const b64url = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64url");

/** PKCE の verifier と challenge（S256） */
export async function pkce(): Promise<{ verifier: string; challenge: string }> {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(48)));
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
  return { verifier, challenge: b64url(digest) };
}

export function authorizeUrl(cfg: XConfig, redirectUri: string, state: string, challenge: string): string {
  const q = new URLSearchParams({
    response_type: "code",
    client_id: cfg.clientId,
    redirect_uri: redirectUri,
    scope: X_SCOPES,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  return `https://x.com/i/oauth2/authorize?${q}`;
}

export class XError extends Error {
  constructor(
    message: string,
    readonly status = 0,
  ) {
    super(message);
  }
}

/** 認可コードをアクセストークンにかえる（シークレットがあれば confidential client として Basic 認証） */
export async function exchangeCode(cfg: XConfig, code: string, verifier: string, redirectUri: string): Promise<string> {
  const body = new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri, code_verifier: verifier, client_id: cfg.clientId });
  const headers: Record<string, string> = { "content-type": "application/x-www-form-urlencoded" };
  if (cfg.clientSecret) headers.authorization = `Basic ${Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString("base64")}`;
  const res = await fetch("https://api.x.com/2/oauth2/token", { method: "POST", headers, body });
  const data = (await res.json().catch(() => ({}))) as { access_token?: string; error_description?: string };
  if (!res.ok || !data.access_token) throw new XError(`token: ${res.status} ${data.error_description ?? ""}`, res.status);
  return data.access_token;
}

export type XProfile = {
  id: string;
  username: string;
  name: string;
  description: string;
  location?: string;
  createdAt?: string;
  followers?: number;
  following?: number;
  posts?: number;
  protected?: boolean;
};

export type XPost = { text: string; createdAt: string; likes: number };

async function getJson<T>(url: string, token: string): Promise<T> {
  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) throw new XError(`${new URL(url).pathname}: ${res.status} ${(await res.text()).slice(0, 200)}`, res.status);
  return (await res.json()) as T;
}

/** ログインした本人のプロフィール（ユーザー1件） */
export async function fetchProfile(token: string): Promise<XProfile> {
  const r = await getJson<{
    data: {
      id: string;
      username: string;
      name: string;
      description?: string;
      location?: string;
      created_at?: string;
      protected?: boolean;
      public_metrics?: { followers_count?: number; following_count?: number; tweet_count?: number };
    };
  }>("https://api.x.com/2/users/me?user.fields=description,location,created_at,protected,public_metrics", token);
  const d = r.data;
  return {
    id: d.id,
    username: d.username,
    name: d.name,
    description: d.description ?? "",
    location: d.location,
    createdAt: d.created_at,
    followers: d.public_metrics?.followers_count,
    following: d.public_metrics?.following_count,
    posts: d.public_metrics?.tweet_count,
    protected: d.protected,
  };
}

/** 本人の最近の投稿（リポストは除く。返信は本人の言葉なので含める）。最大100件 */
export async function fetchPosts(token: string, userId: string): Promise<XPost[]> {
  const q = new URLSearchParams({ max_results: String(POST_COUNT), exclude: "retweets", "tweet.fields": "created_at,public_metrics,note_tweet" });
  const r = await getJson<{
    data?: { text: string; created_at?: string; public_metrics?: { like_count?: number }; note_tweet?: { text?: string } }[];
  }>(`https://api.x.com/2/users/${encodeURIComponent(userId)}/tweets?${q}`, token);
  return (r.data ?? []).map((t) => ({ text: t.note_tweet?.text ?? t.text, createdAt: t.created_at ?? "", likes: t.public_metrics?.like_count ?? 0 }));
}

/** 投稿の文から、URL と他の人の @ID を外す（他の人の名前を AI に渡さない） */
export function cleanPost(text: string): string {
  return text
    .replace(/https?:\/\/\S+/g, "")
    .replace(/@\w{1,15}/g, "@…")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 280);
}

export type Activity = { count: number; lateNightRate: number; morningRate: number; peakHour: number | null; avgLength: number; replyRate: number };

/** 投稿の時間帯（日本時間）や長さの傾向。診断のツッコミの材料にする */
export function activityOf(posts: XPost[]): Activity {
  const hours = posts.map((p) => (p.createdAt ? (new Date(p.createdAt).getUTCHours() + 9) % 24 : -1)).filter((h) => h >= 0);
  const byHour = new Array<number>(24).fill(0);
  for (const h of hours) byHour[h]++;
  const peak = hours.length ? byHour.indexOf(Math.max(...byHour)) : null;
  const rate = (n: number) => (posts.length ? Math.round((n / posts.length) * 100) : 0);
  return {
    count: posts.length,
    lateNightRate: rate(hours.filter((h) => h >= 0 && h < 5).length),
    morningRate: rate(hours.filter((h) => h >= 5 && h < 10).length),
    peakHour: peak,
    avgLength: posts.length ? Math.round(posts.reduce((s, p) => s + Array.from(p.text).length, 0) / posts.length) : 0,
    replyRate: rate(posts.filter((p) => p.text.startsWith("@")).length),
  };
}

/** キーなしで画面を試すための、架空の利用者（X_MOCK=1 のときだけ使う） */
export const MOCK_PROFILE: XProfile = {
  id: "1000000001",
  username: "mio_yoru",
  name: "みお🌙",
  description: "社会人4年目｜深夜アニメと喫茶店めぐり｜推しは画面の中｜コーヒーは2杯まで（守れない）",
  location: "東京",
  createdAt: "2017-04-02T10:00:00.000Z",
  followers: 412,
  following: 380,
  posts: 18230,
};

export function mockPosts(): XPost[] {
  const lines = [
    "寝る", "おはよう（寝てない）", "今日のラテアート、うさぎって言われたけど猫に見える", "締め切りが私を呼んでいる", "このアニメの最終回、無理…情緒がもたない",
    "喫茶店の店主さん、今日も無言でおかわりくれた。好き", "三杯目のコーヒーは見なかったことにする", "電車で寝過ごして終点。景色がきれいだったので実質旅行",
    "@friend それな", "雨の日の喫茶店は世界でいちばん静か", "上司「急ぎじゃないんだけど」→急ぎ", "推しの声で目覚ましを作りたい人生だった",
    "今日こそ早く寝る", "寝れない", "夜中のコンビニのホットスナック、罪の味", "新しい手帳を買った。三日坊主の記録帳になる予定", "金曜の夜だけは無敵",
  ];
  const base = Date.UTC(2026, 9, 30, 15, 0, 0);
  return Array.from({ length: 100 }, (_, i) => ({
    text: lines[i % lines.length],
    // 深夜（日本時間0〜3時）の投稿が多い人
    createdAt: new Date(base - i * 7.3 * 3600 * 1000 - (i % 3) * 3600 * 1000).toISOString(),
    likes: (i * 7) % 23,
  }));
}
