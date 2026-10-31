import { cookies } from "next/headers";
import { after } from "next/server";
import { jacketEnabled } from "@/lib/jacket";
import { getProvider } from "@/lib/llm";
import { getSession } from "@/lib/session";
import { logEvent } from "@/lib/store";
import { createUgc, drawJacket } from "@/lib/ugc";
import { exchangeCode, fetchPosts, fetchProfile, MOCK_PROFILE, mockPosts, X_COOKIE, xConfig, xDailyLimit, XError } from "@/lib/x";
import { analyzeX, looksMinor } from "@/lib/x-analyze";
import { countXToday, createXResult, finishXResult, hashXUser, recentXResult } from "@/lib/x-store";

// 投稿を読んだあと、文章AIで診断と彼の作品を作る（返事を返したあとに続ける）。ジャケットの絵も作る
export const maxDuration = 300;

/** 同じ X アカウントは、この期間は投稿を読み直さずに前の結果を出す */
const REUSE_MS = 3 * 24 * 3600 * 1000;

const back = (req: Request, error: string) => Response.redirect(new URL(`/x?error=${error}`, req.url), 303);

/** X のログインから戻ってくるところ。プロフィールと最近の投稿を読み、結果のページへ送る */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const jar = await cookies();
  const saved = (() => {
    try {
      return JSON.parse(jar.get(X_COOKIE)?.value ?? "null") as { state: string; verifier: string; redirectUri: string } | null;
    } catch {
      return null;
    }
  })();
  jar.delete({ name: X_COOKIE, path: "/api/x" });
  if (url.searchParams.get("error")) return back(req, "denied");
  const code = url.searchParams.get("code");
  if (!saved || !code || url.searchParams.get("state") !== saved.state) return back(req, "state");

  const cfg = xConfig();
  if (!cfg) return back(req, "unavailable");
  const session = await getSession();
  if (!session) return back(req, "session");
  if (session.isMinor) return back(req, "minor");

  try {
    const token = cfg.mock ? "mock" : await exchangeCode(cfg, code, saved.verifier, saved.redirectUri);
    const profile = cfg.mock ? MOCK_PROFILE : await fetchProfile(token);
    if (looksMinor(profile)) return back(req, "minor");
    const xUser = await hashXUser(profile.id);
    const recent = await recentXResult(xUser, REUSE_MS);
    if (recent) return Response.redirect(new URL(`/x/${recent.id}`, req.url), 303);
    if ((await countXToday()) >= xDailyLimit()) return back(req, "busy");

    const posts = cfg.mock ? mockPosts() : await fetchPosts(token, profile.id);
    if (posts.length < 5) return back(req, "few");
    const id = await createXResult(session.id, xUser, profile.username, { name: profile.name });
    await logEvent(session.id, "x_analyze", { id, posts: posts.length });

    // 投稿は、この処理の中でだけ使い、保存しない
    after(async () => {
      try {
        const r = await analyzeX(getProvider(), profile, posts);
        if (!r.ok) return finishXResult(id, "failed", { name: profile.name }, r.error);
        const withJacket = jacketEnabled();
        const plotId = await createUgc(session.id, session.name || profile.name.slice(0, 12) || "名無し", r.analysis.plot, withJacket ? "pending" : "none");
        await finishXResult(id, "ready", { name: profile.name, type: r.analysis.type, roasts: r.analysis.roasts, sweet: r.analysis.sweet, plotId });
        if (withJacket) await drawJacket(plotId);
      } catch (e) {
        console.error("[x/analyze]", id, e);
        await finishXResult(id, "failed", { name: profile.name }, "error");
      }
    });
    return Response.redirect(new URL(`/x/${id}`, req.url), 303);
  } catch (e) {
    console.error("[x/callback]", e);
    // 402 / 429 は、X API のクレジット切れか、回数の上限
    return back(req, e instanceof XError && (e.status === 402 || e.status === 429) ? "busy" : "x");
  }
}
