import { cookies } from "next/headers";
import { completeLogin, exchangeCode, PROVIDERS, providerConfig, safeReturn, type Provider } from "@/lib/auth";
import { getSession, setSessionCookie } from "@/lib/session";
import { logEvent } from "@/lib/store";

const AUTH_COOKIE = "yota_auth";

/** ログインの画面から戻ってくるところ。アカウントの ID を確かめて、この端末をそのアカウントにつなぐ */
export async function GET(req: Request, ctx: RouteContext<"/api/auth/[provider]/callback">) {
  const { provider } = await ctx.params;
  const url = new URL(req.url);
  const jar = await cookies();
  const saved = (() => {
    try {
      return JSON.parse(jar.get(AUTH_COOKIE)?.value ?? "null") as { p: Provider; state: string; nonce: string; verifier: string; ret: string; redirectUri: string } | null;
    } catch {
      return null;
    }
  })();
  jar.delete({ name: AUTH_COOKIE, path: "/api/auth" });
  const ret = safeReturn(saved?.ret);
  const back = (params: string) => Response.redirect(new URL(`${ret}${ret.includes("?") ? "&" : "?"}${params}`, req.url), 303);

  if (url.searchParams.get("error")) return back("login_error=cancel");
  const code = url.searchParams.get("code");
  if (!saved || saved.p !== provider || !code || url.searchParams.get("state") !== saved.state) return back("login_error=state");
  const cfg = PROVIDERS.includes(provider as Provider) ? providerConfig(provider as Provider) : null;
  if (!cfg) return back("login_error=unavailable");

  try {
    const sub = await exchangeCode(cfg, { code, redirectUri: saved.redirectUri, verifier: saved.verifier, nonce: saved.nonce });
    const current = await getSession();
    const r = await completeLogin(cfg.provider, sub, current?.id ?? null);
    if (!r.ok) return back(`login_error=${r.error}`);
    await setSessionCookie(r.sessionId);
    await logEvent(r.sessionId, "login", { provider: cfg.provider, isNew: r.isNew, merged: Boolean(current && current.id !== r.sessionId) });
    return back("login=ok");
  } catch (e) {
    console.error("[auth/callback]", provider, e);
    return back("login_error=failed");
  }
}
