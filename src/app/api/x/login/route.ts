import { cookies } from "next/headers";
import { getSession } from "@/lib/session";
import { countRecent } from "@/lib/ugc";
import { authorizeUrl, pkce, X_COOKIE, X_PER_SESSION, xConfig, xDailyLimit } from "@/lib/x";
import { countXToday } from "@/lib/x-store";

const back = (req: Request, error: string) => Response.redirect(new URL(`/x?error=${error}`, req.url), 303);

/** X のログイン画面へ送る。戻り先で確かめる state と PKCE の verifier は、10分だけ cookie に置く */
export async function GET(req: Request) {
  const cfg = xConfig();
  if (!cfg) return back(req, "unavailable");
  const session = await getSession();
  if (!session) return back(req, "session");
  if (session.isMinor) return back(req, "minor");
  if ((await countXToday()) >= xDailyLimit()) return back(req, "busy");
  if ((await countRecent(session.id, "x_analyze")) >= X_PER_SESSION) return back(req, "limit");

  const state = Buffer.from(crypto.getRandomValues(new Uint8Array(24))).toString("base64url");
  const { verifier, challenge } = await pkce();
  const redirectUri = cfg.redirectUri ?? new URL("/api/x/callback", req.url).toString();
  (await cookies()).set(X_COOKIE, JSON.stringify({ state, verifier, redirectUri }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && new URL(req.url).protocol === "https:",
    path: "/api/x",
    maxAge: 600,
  });
  if (cfg.mock) return Response.redirect(`${redirectUri}?code=mock&state=${state}`, 303);
  return Response.redirect(authorizeUrl(cfg, redirectUri, state, challenge), 303);
}
