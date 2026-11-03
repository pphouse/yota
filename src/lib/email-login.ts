/**
 * メールアドレスでのログイン（6けたのコードをメールで送り、画面に入れてもらう）。サーバー専用。
 *
 * - リンクではなくコードにする：メールのリンクは端末のブラウザで開くので、アプリの中で始めたログインがアプリに残らない。
 * - メールアドレスは、送るときにだけ使う。保存するのはハッシュだけ（ログインの ID も、コードの記録も）。
 * - いたずらで大量に送られないよう、同じアドレス・同じ接続元・全体の1日の数に上限を置く。
 */
import { db, query, run } from "./db";

type Env = Record<string, string | undefined>;

export const CODE_TTL_MS = 10 * 60 * 1000;
/** 1つのコードで、まちがえてよい回数 */
export const MAX_TRIES = 5;
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** 送り直すまでに待つ時間・1時間に送れる数（同じアドレス・同じ接続元）・全体で1日に送れる数 */
export const LIMITS = { resendWaitMs: MINUTE, perEmailPerHour: 5, perIpPerHour: 10 };
const dailyLimit = (env: Env = process.env) => Number(env.EMAIL_DAILY_LIMIT ?? 500);

/** メールアドレスを、比べられる形にそろえる。正しくなければ null */
export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.normalize("NFKC").trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@"<>()[\],;:]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(email)) return null;
  return email;
}

const enc = new TextEncoder();
async function sha256(s: string): Promise<string> {
  return Buffer.from(await crypto.subtle.digest("SHA-256", enc.encode(s))).toString("hex");
}
const salt = () => process.env.AUTH_HASH_SALT ?? "yota-auth";
const emailHash = (email: string) => sha256(`${salt()}:email-code:${email}`);
const codeHash = (id: string, code: string) => sha256(`${salt()}:${id}:${code}`);

/** 接続元（IP）を、元に戻せない形にする */
export async function ipHash(req: Request): Promise<string> {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  return (await sha256(`${salt()}:ip:${ip}`)).slice(0, 16);
}

/** 6けたのコード */
export function makeCode(): string {
  // 偏りが出ないよう、1,000,000 の倍数に収まる値だけを使う
  const limit = Math.floor(0x1_0000_0000 / 1_000_000) * 1_000_000;
  for (;;) {
    const n = crypto.getRandomValues(new Uint32Array(1))[0];
    if (n < limit) return String(n % 1_000_000).padStart(6, "0");
  }
}

export type Mailer = (to: string, code: string) => Promise<void>;

/** コードのメールの文面 */
export function codeMail(code: string): { subject: string; text: string; html: string } {
  const minutes = CODE_TTL_MS / MINUTE;
  const text = [
    "yota のログインコードです。",
    "",
    code,
    "",
    `${minutes}分以内に、yota の画面に入力してください。`,
    "このメールに心当たりがない場合は、何もせずに削除してください。だれかがメールアドレスを入れまちがえた可能性があります。",
    "",
    "yota https://yotachat.app",
  ].join("\n");
  const html = `<div style="font-family:sans-serif;line-height:1.8;color:#222">
<p>yota のログインコードです。</p>
<p style="font-size:30px;font-weight:bold;letter-spacing:6px;margin:16px 0">${code}</p>
<p>${minutes}分以内に、yota の画面に入力してください。</p>
<p style="color:#777;font-size:13px">このメールに心当たりがない場合は、何もせずに削除してください。だれかがメールアドレスを入れまちがえた可能性があります。</p>
<p style="color:#777;font-size:13px">yota <a href="https://yotachat.app">https://yotachat.app</a></p>
</div>`;
  // 件名にもコードを入れる（通知で見えて、iPhone ではキーボードの上に候補として出る）
  return { subject: `yota のログインコード ${code}`, text, html };
}

/** Resend でメールを送る。EMAIL_MOCK のときは送らずにサーバーのログに出す */
export const sendWithResend: Mailer = async (to, code) => {
  const mail = codeMail(code);
  if (!process.env.RESEND_API_KEY) {
    console.log(`[email-mock] ${to} のログインコード：${code}`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM ?? "yota <login@yotachat.app>", to: [to], subject: mail.subject, text: mail.text, html: mail.html }),
  });
  if (!res.ok) throw new Error(`メールを送れませんでした（${res.status} ${(await res.text().catch(() => "")).slice(0, 200)}）`);
};

const count = async (sql: string, args: (string | number)[]) => Number((await query<{ n: number }>(sql, args))[0]?.n ?? 0);

export type SendResult = { ok: true } | { ok: false; error: "wait" | "too_many" | "busy" | "failed" };

/** コードを作って送る */
export async function sendLoginCode(email: string, ip: string, mailer: Mailer = sendWithResend, now = Date.now()): Promise<SendResult> {
  const eh = await emailHash(email);
  // 古い記録は消す
  await run("DELETE FROM email_codes WHERE created_at < ?", [now - DAY]);
  const last = (await query<{ created_at: number }>("SELECT created_at FROM email_codes WHERE email_hash = ? ORDER BY created_at DESC LIMIT 1", [eh]))[0];
  if (last && now - Number(last.created_at) < LIMITS.resendWaitMs) return { ok: false, error: "wait" };
  if ((await count("SELECT COUNT(*) AS n FROM email_codes WHERE email_hash = ? AND created_at >= ?", [eh, now - HOUR])) >= LIMITS.perEmailPerHour) return { ok: false, error: "too_many" };
  if ((await count("SELECT COUNT(*) AS n FROM email_codes WHERE ip = ? AND created_at >= ?", [ip, now - HOUR])) >= LIMITS.perIpPerHour) return { ok: false, error: "too_many" };
  if ((await count("SELECT COUNT(*) AS n FROM email_codes WHERE created_at >= ?", [now - DAY])) >= dailyLimit()) return { ok: false, error: "busy" };

  const id = crypto.randomUUID();
  const code = makeCode();
  // 前に送ったコードは使えなくする（いちばん新しいコードだけが有効）
  await run("UPDATE email_codes SET used = 1 WHERE email_hash = ? AND used = 0", [eh]);
  await run("INSERT INTO email_codes (id, email_hash, code_hash, ip, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)", [
    id,
    eh,
    await codeHash(id, code),
    ip,
    now,
    now + CODE_TTL_MS,
  ]);
  try {
    await mailer(email, code);
  } catch (e) {
    console.error("[email-login] send", e);
    // 送れなかったものは数えない
    await run("DELETE FROM email_codes WHERE id = ?", [id]);
    return { ok: false, error: "failed" };
  }
  return { ok: true };
}

export type VerifyResult = { ok: true } | { ok: false; error: "expired" | "wrong" | "too_many"; left?: number };

/** コードを確かめる。合っていれば、そのコードはもう使えなくする */
export async function verifyLoginCode(email: string, code: string, now = Date.now()): Promise<VerifyResult> {
  const eh = await emailHash(email);
  const row = (
    await query<{ id: string; code_hash: string; tries: number }>(
      "SELECT id, code_hash, tries FROM email_codes WHERE email_hash = ? AND used = 0 AND expires_at > ? ORDER BY created_at DESC LIMIT 1",
      [eh, now],
    )
  )[0];
  if (!row) return { ok: false, error: "expired" };
  const tries = Number(row.tries);
  if (tries >= MAX_TRIES) return { ok: false, error: "too_many" };
  const digits = code.normalize("NFKC").replace(/\D/g, "");
  if (digits.length !== 6 || (await codeHash(row.id, digits)) !== row.code_hash) {
    await run("UPDATE email_codes SET tries = tries + 1 WHERE id = ?", [row.id]);
    return tries + 1 >= MAX_TRIES ? { ok: false, error: "too_many" } : { ok: false, error: "wrong", left: MAX_TRIES - tries - 1 };
  }
  // 同時に2回送られても、使えるのは1回だけ
  const done = await (await db()).execute({ sql: "UPDATE email_codes SET used = 1 WHERE id = ? AND used = 0", args: [row.id] });
  if (done.rowsAffected === 0) return { ok: false, error: "expired" };
  return { ok: true };
}
