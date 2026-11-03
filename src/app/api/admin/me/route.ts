import { adminEnabled, isAdmin } from "@/lib/admin";

/** 管理者画面が使えるか、いまログインしているか */
export async function GET() {
  // isAdmin が先に cookie を読むので、リクエストごとに答える（パスワードを入れたあとの再デプロイなしでも、起動時の環境変数を読む）
  const admin = await isAdmin();
  return Response.json({ enabled: adminEnabled(), admin });
}
