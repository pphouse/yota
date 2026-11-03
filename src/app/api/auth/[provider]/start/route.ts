import { cookies } from "next/headers";
import { authorizeUrl, pkce, PROVIDERS, providerConfig, randomToken, safeReturn, type Provider } from "@/lib/auth";

const AUTH_COOKIE = "yota_auth";

/** ログインの画面へ送る。戻り先で確かめる state・PKCE・nonce と、ログインのあとに戻る場所を、10分だけ cookie に置く */
export async function GET(req: Request, ctx: RouteContext<"/api/auth/[provider]/start">) {
  const { provider } = await ctx.params;
  const url = new URL(req.url);
  const ret = safeReturn(url.searchParams.get("return"));
  const cfg = PROVIDERS.includes(provider as Provider) ? providerConfig(provider as Provider) : null;
  if (!cfg) return Response.redirect(new URL(`${ret}${ret.includes("?") ? "&" : "?"}login_error=unavailable`, req.url), 303);
  const state = randomToken();
  const nonce = randomToken();
  const { verifier, challenge } = await pkce();
  const redirectUri = new URL(`/api/auth/${cfg.provider}/callback`, req.url).toString();
  (await cookies()).set(AUTH_COOKIE, JSON.stringify({ p: cfg.provider, state, nonce, verifier, ret, redirectUri }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && url.protocol === "https:",
    path: "/api/auth",
    maxAge: 600,
  });
  return Response.redirect(authorizeUrl(cfg, { redirectUri, state, nonce, challenge }), 303);
}
