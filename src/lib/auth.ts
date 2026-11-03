/**
 * ログイン（LINE・Google・Apple・メールアドレス）。サーバー専用。
 *
 * yota は登録なしで始められる（匿名のセッション）。ログインは、そのセッションに外部のアカウントを結びつけるだけ：
 * - はじめてのアカウントなら、いまのセッションに結びつける（ゲストのときの会話・作品はそのまま）。
 * - すでに結びついたアカウントなら、そのセッションに切りかえ、いまのゲストの会話・作品をそちらへ移す。
 * 外部のアカウントの ID は、元に戻せない形（ハッシュ）にして持つ。メールアドレスは求めず、名前などのプロフィールは保存しない。
 */
import { query, run } from "./db";

export type Provider = "line" | "google" | "apple" | "email";
/** ほかのサービスの画面へ移ってログインするもの（メールアドレスは、コードを送る別の流れ：email-login.ts） */
export type OAuthProvider = Exclude<Provider, "email">;
export const OAUTH_PROVIDERS: OAuthProvider[] = ["line", "google", "apple"];
export const PROVIDER_LABEL: Record<Provider, string> = { line: "LINE", google: "Google", apple: "Apple", email: "メールアドレス" };

type Env = Record<string, string | undefined>;

export type ProviderConfig =
  | { provider: "line"; clientId: string; clientSecret: string }
  | { provider: "google"; clientId: string; clientSecret: string }
  | { provider: "apple"; clientId: string; teamId: string; keyId: string; privateKey: string };

export function providerConfig(p: OAuthProvider, env: Env = process.env): ProviderConfig | null {
  if (p === "line" && env.LINE_CHANNEL_ID && env.LINE_CHANNEL_SECRET) return { provider: p, clientId: env.LINE_CHANNEL_ID, clientSecret: env.LINE_CHANNEL_SECRET };
  if (p === "google" && env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) return { provider: p, clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET };
  if (p === "apple" && env.APPLE_SIGNIN_CLIENT_ID && env.APPLE_TEAM_ID && env.APPLE_SIGNIN_KEY_ID && env.APPLE_SIGNIN_PRIVATE_KEY) {
    return { provider: p, clientId: env.APPLE_SIGNIN_CLIENT_ID, teamId: env.APPLE_TEAM_ID, keyId: env.APPLE_SIGNIN_KEY_ID, privateKey: env.APPLE_SIGNIN_PRIVATE_KEY };
  }
  return null;
}

/** メールでログインできるか（送るためのキーがあるか。EMAIL_MOCK は本番以外で、送らずに試すためのもの） */
export const emailEnabled = (env: Env = process.env) => Boolean(env.RESEND_API_KEY) || (env.EMAIL_MOCK === "1" && env.VERCEL_ENV !== "production");

/** キーが入っているログインの手段 */
export const enabledProviders = (env: Env = process.env): Provider[] => [
  ...OAUTH_PROVIDERS.filter((p) => providerConfig(p, env)),
  ...(emailEnabled(env) ? (["email"] as const) : []),
];
/** ログインが使えるか（使えないあいだは、ゲストの上限もかけない） */
export const authEnabled = (env: Env = process.env) => enabledProviders(env).length > 0;

/** ゲスト（ログインしていない人）が送れるメッセージの数。3往復目の山場を、いくつかの作品で体験できるくらい */
export const guestLimit = (env: Env = process.env) => Number(env.GUEST_MESSAGE_LIMIT ?? 15);

/** iOS・Android のアプリからのアクセスか（アプリは User-Agent の末尾に YotaApp を付ける：capacitor.config.ts） */
export const fromApp = (req: Request) => /\bYotaApp\b/.test(req.headers.get("user-agent") ?? "");

/**
 * ゲストの上限をかけるか。アプリを入れた人はゲストとして扱わない（入れること自体が、続けて使うという意思なので）。
 * Web では、ログインの手段が1つでも使えるときだけかける
 */
export const guestLimited = (req: Request, env: Env = process.env) => authEnabled(env) && !fromApp(req);

/** ログインのあとに戻る場所（同じサイトの中だけ） */
export function safeReturn(raw: string | null | undefined): string {
  return raw && raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/api/") ? raw.slice(0, 300) : "/";
}

const b64url = (bytes: Uint8Array | ArrayBuffer) => Buffer.from(bytes as ArrayBuffer).toString("base64url");
const enc = new TextEncoder();

export async function pkce(): Promise<{ verifier: string; challenge: string }> {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(48)));
  return { verifier, challenge: b64url(await crypto.subtle.digest("SHA-256", enc.encode(verifier))) };
}

export const randomToken = () => b64url(crypto.getRandomValues(new Uint8Array(24)));

/** ログインの画面の URL。使うのは、アカウントを見分ける ID だけ（メールは求めない。LINE は決まりで profile も付けるが、保存しない） */
export function authorizeUrl(cfg: ProviderConfig, o: { redirectUri: string; state: string; nonce: string; challenge: string }): string {
  if (cfg.provider === "line") {
    const q = new URLSearchParams({ response_type: "code", client_id: cfg.clientId, redirect_uri: o.redirectUri, state: o.state, scope: "profile openid", nonce: o.nonce, code_challenge: o.challenge, code_challenge_method: "S256" });
    return `https://access.line.me/oauth2/v2.1/authorize?${q}`;
  }
  if (cfg.provider === "google") {
    const q = new URLSearchParams({ response_type: "code", client_id: cfg.clientId, redirect_uri: o.redirectUri, state: o.state, scope: "openid", nonce: o.nonce, code_challenge: o.challenge, code_challenge_method: "S256", prompt: "select_account" });
    return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
  }
  // Apple：名前・メールを求めなければ、戻り先は GET（query）で受け取れる
  const q = new URLSearchParams({ response_type: "code", response_mode: "query", client_id: cfg.clientId, redirect_uri: o.redirectUri, state: o.state, nonce: o.nonce });
  return `https://appleid.apple.com/auth/authorize?${q}`;
}

type Claims = { iss?: string; aud?: string | string[]; sub?: string; exp?: number; nonce?: string };

export function decodeJwt(token: string): { header: Record<string, unknown>; payload: Claims; signingInput: string; signature: string } {
  const [h, p, s] = token.split(".");
  if (!h || !p || !s) throw new Error("id_token の形が正しくありません");
  return { header: JSON.parse(Buffer.from(h, "base64url").toString("utf8")), payload: JSON.parse(Buffer.from(p, "base64url").toString("utf8")), signingInput: `${h}.${p}`, signature: s };
}

async function hs256(secret: string, input: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(input)));
}

/** id_token の中身を確かめる（発行元・宛先・期限・nonce） */
export function checkClaims(c: Claims, o: { iss: string[]; aud: string; nonce: string; now?: number }): string {
  const aud = Array.isArray(c.aud) ? c.aud : [c.aud];
  if (!c.iss || !o.iss.includes(c.iss)) throw new Error("発行元が違います");
  if (!aud.includes(o.aud)) throw new Error("宛先が違います");
  if (!c.exp || c.exp * 1000 < (o.now ?? Date.now()) - 60_000) throw new Error("期限が切れています");
  if (c.nonce !== undefined && c.nonce !== o.nonce) throw new Error("nonce が違います");
  if (!c.sub) throw new Error("ID がありません");
  return c.sub;
}

/** Apple のトークンの API に渡す client_secret（ES256 で署名した JWT。Apple の鍵 .p8 で作る） */
export async function appleClientSecret(cfg: Extract<ProviderConfig, { provider: "apple" }>, now = Date.now()): Promise<string> {
  const pem = cfg.privateKey.replace(/\\n/g, "\n").replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const key = await crypto.subtle.importKey("pkcs8", Buffer.from(pem, "base64"), { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const iat = Math.floor(now / 1000);
  const header = b64url(enc.encode(JSON.stringify({ alg: "ES256", kid: cfg.keyId })));
  const payload = b64url(enc.encode(JSON.stringify({ iss: cfg.teamId, iat, exp: iat + 3600, aud: "https://appleid.apple.com", sub: cfg.clientId })));
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(`${header}.${payload}`));
  return `${header}.${payload}.${b64url(sig)}`;
}

async function postForm(url: string, body: Record<string, string>): Promise<{ id_token?: string; error?: string; error_description?: string }> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(body) });
  const data = (await res.json().catch(() => ({}))) as { id_token?: string; error?: string; error_description?: string };
  if (!res.ok || !data.id_token) throw new Error(`トークンを受け取れませんでした（${res.status} ${data.error ?? ""}）`);
  return data;
}

/** 認可コードを id_token にかえ、アカウントの ID（sub）を取り出す */
export async function exchangeCode(cfg: ProviderConfig, o: { code: string; redirectUri: string; verifier: string; nonce: string }): Promise<string> {
  if (cfg.provider === "line") {
    const { id_token } = await postForm("https://api.line.me/oauth2/v2.1/token", {
      grant_type: "authorization_code",
      code: o.code,
      redirect_uri: o.redirectUri,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      code_verifier: o.verifier,
    });
    // LINE の id_token は、チャネルシークレットで署名されている（HS256）ので、署名も確かめる
    const jwt = decodeJwt(id_token!);
    if (jwt.header.alg !== "HS256" || (await hs256(cfg.clientSecret, jwt.signingInput)) !== jwt.signature) throw new Error("署名が違います");
    return checkClaims(jwt.payload, { iss: ["https://access.line.me"], aud: cfg.clientId, nonce: o.nonce });
  }
  if (cfg.provider === "google") {
    const { id_token } = await postForm("https://oauth2.googleapis.com/token", {
      grant_type: "authorization_code",
      code: o.code,
      redirect_uri: o.redirectUri,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      code_verifier: o.verifier,
    });
    // トークンの API から TLS で直接受け取った id_token なので、中身の確かめだけでよい（OpenID Connect の決まり）
    return checkClaims(decodeJwt(id_token!).payload, { iss: ["https://accounts.google.com", "accounts.google.com"], aud: cfg.clientId, nonce: o.nonce });
  }
  const { id_token } = await postForm("https://appleid.apple.com/auth/token", {
    grant_type: "authorization_code",
    code: o.code,
    redirect_uri: o.redirectUri,
    client_id: cfg.clientId,
    client_secret: await appleClientSecret(cfg),
  });
  return checkClaims(decodeJwt(id_token!).payload, { iss: ["https://appleid.apple.com"], aud: cfg.clientId, nonce: o.nonce });
}

/** 外部のアカウントの ID は、元に戻せない形にして持つ */
export async function hashSubject(p: Provider, sub: string): Promise<string> {
  const salt = process.env.AUTH_HASH_SALT ?? "yota-auth";
  return Buffer.from(await crypto.subtle.digest("SHA-256", enc.encode(`${salt}:${p}:${sub}`))).toString("hex");
}

/** そのセッションに結びついたログインの手段（ログインしていなければ空） */
export async function accountOf(sessionId: string): Promise<Provider[]> {
  const rows = await query<{ provider: Provider }>("SELECT provider FROM identities WHERE session_id = ? ORDER BY created_at", [sessionId]);
  return rows.map((r) => r.provider);
}

export async function isLoggedIn(sessionId: string): Promise<boolean> {
  return (await accountOf(sessionId)).length > 0;
}

/** ゲストのときに送ったメッセージの数 */
export async function sentMessages(sessionId: string): Promise<number> {
  const rows = await query<{ n: number }>(
    "SELECT COUNT(*) AS n FROM messages m JOIN conversations c ON c.id = m.conversation_id WHERE c.session_id = ? AND m.role = 'user'",
    [sessionId],
  );
  return Number(rows[0]?.n ?? 0);
}

/** ゲストのセッション（from）の会話・作品などを、アカウントのセッション（to）へ移し、ゲストのセッションを消す */
export async function mergeSessions(from: string, to: string): Promise<void> {
  if (from === to) return;
  for (const table of ["conversations", "user_plots", "ugc_images", "x_results", "push_tokens", "feedback", "events", "llm_usage", "identities"]) {
    await run(`UPDATE ${table} SET session_id = ? WHERE session_id = ?`, [to, from]);
  }
  // ブロックと利用時間は、同じ組み合わせがあれば移さずに消す
  await run("UPDATE OR IGNORE blocks SET session_id = ? WHERE session_id = ?", [to, from]);
  await run("UPDATE OR IGNORE blocks SET author_session_id = ? WHERE author_session_id = ?", [to, from]);
  await run("DELETE FROM blocks WHERE session_id = ? OR author_session_id = ?", [from, from]);
  await run("UPDATE OR IGNORE usage SET session_id = ? WHERE session_id = ?", [to, from]);
  await run("DELETE FROM usage WHERE session_id = ?", [from]);
  await run("DELETE FROM sessions WHERE id = ?", [from]);
}

export type LoginResult = { ok: true; sessionId: string; isNew: boolean } | { ok: false; error: "needs_age" };

/**
 * ログインを終える。すでに結びついたアカウントなら、そのセッションに切りかえ（いまのゲストの記録を移す）、
 * はじめてのアカウントなら、いまのセッションに結びつける。セッションがない（年齢の確認の前の）はじめての人は、先に年齢の確認をしてもらう
 */
export async function completeLogin(p: Provider, sub: string, currentSessionId: string | null): Promise<LoginResult> {
  const subject = await hashSubject(p, sub);
  const now = Date.now();
  const found = (await query<{ session_id: string }>("SELECT session_id FROM identities WHERE provider = ? AND subject = ?", [p, subject]))[0];
  if (found) {
    // ゲストの記録だけを移す。別のアカウントでログイン中だったなら、混ぜずに切りかえるだけ
    if (currentSessionId && currentSessionId !== found.session_id && !(await isLoggedIn(currentSessionId))) await mergeSessions(currentSessionId, found.session_id);
    await run("UPDATE identities SET last_login_at = ? WHERE provider = ? AND subject = ?", [now, p, subject]);
    return { ok: true, sessionId: found.session_id, isNew: false };
  }
  if (!currentSessionId) return { ok: false, error: "needs_age" };
  await run("INSERT INTO identities (provider, subject, session_id, created_at, last_login_at) VALUES (?, ?, ?, ?, ?)", [p, subject, currentSessionId, now, now]);
  return { ok: true, sessionId: currentSessionId, isNew: true };
}
