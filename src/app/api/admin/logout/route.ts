import { clearAdminCookie } from "@/lib/admin";

export async function POST() {
  await clearAdminCookie();
  return Response.json({ ok: true });
}
