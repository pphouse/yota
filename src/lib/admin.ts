/**
 * 管理者画面の入り口（サーバー専用）。Vercel の環境変数 ADMIN_PASSWORD で守る。
 * ログインすると、パスワードで署名した期限つきの cookie を置く（パスワードを変えると、それまでのログインは切れる）。
 */
import { cookies } from "next/headers";

export const ADMIN_COOKIE = "yota_admin";
/** ログインが続く長さ */
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const adminEnabled = (env: Record<string, string | undefined> = process.env) => Boolean(env.ADMIN_PASSWORD && env.ADMIN_PASSWORD.length >= 8);

const enc = new TextEncoder();

async function hmac(key: string, value: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return Buffer.from(await crypto.subtle.sign("HMAC", k, enc.encode(value))).toString("hex");
}

/** 長さや中身で時間が変わらないように比べる */
function same(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function checkPassword(input: string, password = process.env.ADMIN_PASSWORD ?? ""): Promise<boolean> {
  if (!password) return false;
  // ハッシュにしてから比べる（長さの違いも漏らさない）
  return same(await hmac("yota-admin-check", input), await hmac("yota-admin-check", password));
}

export async function makeToken(now = Date.now(), password = process.env.ADMIN_PASSWORD ?? ""): Promise<string> {
  const exp = String(now + TTL_MS);
  return `${exp}.${await hmac(password, `admin:${exp}`)}`;
}

export async function verifyToken(token: string | undefined, now = Date.now(), password = process.env.ADMIN_PASSWORD ?? ""): Promise<boolean> {
  if (!token || !password) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig || Number(exp) < now) return false;
  return same(sig, await hmac(password, `admin:${exp}`));
}

/**
 * いまのリクエストが管理者か。先に cookie を読む（読まずに返すと、ビルドのときの答え＝パスワードなしの結果で固定されてしまう）
 */
export async function isAdmin(): Promise<boolean> {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!adminEnabled()) return false;
  return verifyToken(token);
}

export async function setAdminCookie(): Promise<void> {
  (await cookies()).set(ADMIN_COOKIE, await makeToken(), {
    httpOnly: true,
    // ほかのサイトからの操作に cookie を付けない
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TTL_MS / 1000,
  });
}

export async function clearAdminCookie(): Promise<void> {
  (await cookies()).delete({ name: ADMIN_COOKIE, path: "/" });
}

/** 管理者でなければ 401 を返す（API の最初で使う） */
export async function requireAdmin(): Promise<Response | null> {
  return (await isAdmin()) ? null : Response.json({ error: "管理者としてログインしてください" }, { status: 401 });
}
