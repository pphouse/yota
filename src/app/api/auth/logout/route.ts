import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/session";

/** ログアウト：この端末とアカウントのつながりを外す（記録はアカウントに残る。もう一度ログインすれば戻る） */
export async function POST() {
  (await cookies()).delete(SESSION_COOKIE);
  return Response.json({ ok: true });
}
