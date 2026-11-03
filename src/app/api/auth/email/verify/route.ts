import { completeLogin, emailEnabled } from "@/lib/auth";
import { normalizeEmail, verifyLoginCode } from "@/lib/email-login";
import { getSession, setSessionCookie } from "@/lib/session";
import { logEvent } from "@/lib/store";

/** メールでのログイン②：コードを確かめて、この端末をそのアカウントにつなぐ */
export async function POST(req: Request) {
  if (!emailEnabled()) return Response.json({ error: "メールでのログインは、まだ準備中です。" }, { status: 503 });
  const body = (await req.json().catch(() => null)) as { email?: unknown; code?: unknown } | null;
  const email = normalizeEmail(body?.email);
  if (!email || typeof body?.code !== "string") return Response.json({ error: "メールアドレスとコードを入れてください。" }, { status: 400 });

  const v = await verifyLoginCode(email, body.code);
  if (!v.ok) {
    const error =
      v.error === "wrong"
        ? `コードが違います（あと${v.left}回まで）。`
        : v.error === "too_many"
          ? "まちがいが続いたので、このコードは使えなくなりました。コードを送り直してください。"
          : "コードの期限が切れました。コードを送り直してください。";
    return Response.json({ error, code: v.error }, { status: 400 });
  }

  const current = await getSession();
  const r = await completeLogin("email", email, current?.id ?? null);
  if (!r.ok) {
    return Response.json(
      { error: "はじめての方は、先に年齢の確認をしてください。そのあとでログインできます。", code: "needs_age" },
      { status: 403 },
    );
  }
  await setSessionCookie(r.sessionId);
  await logEvent(r.sessionId, "login", { provider: "email", isNew: r.isNew, merged: Boolean(current && current.id !== r.sessionId) });
  return Response.json({ ok: true });
}
