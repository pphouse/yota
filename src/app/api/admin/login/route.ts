import { z } from "zod";
import { adminEnabled, checkPassword, setAdminCookie } from "@/lib/admin";
import { query } from "@/lib/db";
import { logEvent } from "@/lib/store";

/** 15分のあいだに失敗してよい回数（パスワードの総当たりを防ぐ） */
const MAX_FAILURES = 8;

const Body = z.object({ password: z.string().min(1).max(200) });

/** 接続元（IP）を、元に戻せない形にする */
async function who(req: Request): Promise<string> {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`yota-admin:${ip}`)));
  return Buffer.from(d).toString("hex").slice(0, 16);
}

export async function POST(req: Request) {
  if (!adminEnabled()) return Response.json({ error: "管理者画面は使えません（ADMIN_PASSWORD が設定されていません）" }, { status: 503 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "パスワードを入れてください" }, { status: 400 });
  const ip = await who(req);
  const failures = Number(
    (
      await query<{ n: number }>("SELECT COUNT(*) AS n FROM events WHERE type = 'admin_login_failed' AND props LIKE ? AND created_at >= ?", [
        `%${ip}%`,
        Date.now() - 15 * 60 * 1000,
      ])
    )[0]?.n ?? 0,
  );
  if (failures >= MAX_FAILURES) return Response.json({ error: "失敗が続いたので、しばらく待ってからお試しください" }, { status: 429 });
  if (!(await checkPassword(parsed.data.password))) {
    await logEvent(null, "admin_login_failed", { ip });
    // 総当たりを遅くする
    await new Promise((r) => setTimeout(r, 800));
    return Response.json({ error: "パスワードが違います" }, { status: 401 });
  }
  await setAdminCookie();
  await logEvent(null, "admin_login", { ip });
  return Response.json({ ok: true });
}
