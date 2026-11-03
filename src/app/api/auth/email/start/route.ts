import { emailEnabled } from "@/lib/auth";
import { ipHash, normalizeEmail, sendLoginCode } from "@/lib/email-login";

const ERRORS = {
  wait: { status: 429, error: "少し待ってから、もう一度送ってください。" },
  too_many: { status: 429, error: "送った回数が多すぎます。しばらく時間をおいてお試しください。" },
  busy: { status: 503, error: "いま混み合っています。しばらく時間をおいてお試しください。" },
  failed: { status: 502, error: "メールを送れませんでした。メールアドレスを確かめて、もう一度お試しください。" },
};

/** メールでのログイン①：6けたのコードをメールで送る */
export async function POST(req: Request) {
  if (!emailEnabled()) return Response.json({ error: "メールでのログインは、まだ準備中です。" }, { status: 503 });
  const body = (await req.json().catch(() => null)) as { email?: unknown } | null;
  const email = normalizeEmail(body?.email);
  if (!email) return Response.json({ error: "メールアドレスを正しく入力してください。" }, { status: 400 });
  const r = await sendLoginCode(email, await ipHash(req));
  if (!r.ok) return Response.json({ error: ERRORS[r.error].error, code: r.error }, { status: ERRORS[r.error].status });
  return Response.json({ ok: true });
}
