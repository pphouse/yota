import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getPlot } from "./characters";
import { resetDbForTests } from "./db";
import type { GenerateRequest, LLMProvider } from "./llm/types";
import { toInput } from "./ugc-draft";
import { activityOf, authorizeUrl, cleanPost, exchangeCode, fetchPosts, fetchProfile, MOCK_PROFILE, mockPosts, pkce, xConfig } from "./x";
import { analyzeX, looksMinor, material, X_TAG } from "./x-analyze";
import { countXToday, createXResult, finishXResult, getXResult, hashXUser, recentXResult } from "./x-store";

beforeEach(() => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "yota-x-"));
  resetDbForTests(`file:${path.join(dir, "test.db")}`);
});
afterEach(() => vi.unstubAllGlobals());

describe("X のログイン", () => {
  it("キーがなければ使えない。試し用の X_MOCK は本番では効かない", () => {
    expect(xConfig({})).toBeNull();
    expect(xConfig({ X_CLIENT_ID: "id", X_CLIENT_SECRET: "s" })).toMatchObject({ clientId: "id", clientSecret: "s", mock: false });
    expect(xConfig({ X_MOCK: "1" })?.mock).toBe(true);
    expect(xConfig({ X_MOCK: "1", VERCEL_ENV: "production" })).toBeNull();
  });

  it("PKCE の challenge は verifier の SHA-256（S256）で、ログインの URL に読み取りだけの権限を付ける", async () => {
    const { verifier, challenge } = await pkce();
    const digest = Buffer.from(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))).toString("base64url");
    expect(challenge).toBe(digest);
    const url = new URL(authorizeUrl({ clientId: "cid", mock: false }, "https://yotachat.app/api/x/callback", "st", challenge));
    expect(url.origin + url.pathname).toBe("https://x.com/i/oauth2/authorize");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      response_type: "code",
      client_id: "cid",
      scope: "tweet.read users.read",
      state: "st",
      code_challenge_method: "S256",
      redirect_uri: "https://yotachat.app/api/x/callback",
    });
  });

  it("シークレットがあれば Basic 認証でトークンにかえる", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ access_token: "tok" })));
    vi.stubGlobal("fetch", fetchMock);
    expect(await exchangeCode({ clientId: "cid", clientSecret: "sec", mock: false }, "code1", "ver1", "https://r")).toBe("tok");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.x.com/2/oauth2/token");
    expect((init.headers as Record<string, string>).authorization).toBe(`Basic ${Buffer.from("cid:sec").toString("base64")}`);
    expect(Object.fromEntries(new URLSearchParams(String(init.body)))).toMatchObject({ grant_type: "authorization_code", code: "code1", code_verifier: "ver1" });
  });

  it("プロフィールと投稿100件（リポストを除く）を読み、長い投稿は全文を使う", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.includes("/users/me")
        ? new Response(JSON.stringify({ data: { id: "42", username: "mio", name: "みお", description: "喫茶店", public_metrics: { followers_count: 3 } } }))
        : new Response(JSON.stringify({ data: [{ text: "短い…", note_tweet: { text: "長い全文" }, created_at: "2026-10-30T17:00:00.000Z" }, { text: "寝る" }] })),
    );
    vi.stubGlobal("fetch", fetchMock);
    expect(await fetchProfile("tok")).toMatchObject({ id: "42", username: "mio", description: "喫茶店", followers: 3 });
    const posts = await fetchPosts("tok", "42");
    expect(posts.map((p) => p.text)).toEqual(["長い全文", "寝る"]);
    const postsUrl = new URL(String(fetchMock.mock.calls[1][0]));
    expect(postsUrl.pathname).toBe("/2/users/42/tweets");
    expect(postsUrl.searchParams.get("max_results")).toBe("100");
    expect(postsUrl.searchParams.get("exclude")).toBe("retweets");
  });
});

describe("投稿の材料", () => {
  it("URL とほかの人の ID は AI に渡さない", () => {
    expect(cleanPost("@friend それな https://t.co/abc 見て")).toBe("@… それな 見て");
    const m = material(MOCK_PROFILE, [{ text: "読んで https://example.com @someone", createdAt: "", likes: 0 }]);
    expect(m).not.toContain("example.com");
    expect(m).not.toContain("someone");
  });

  it("時間帯の傾向を日本時間で数える", () => {
    const at = (h: number) => new Date(Date.UTC(2026, 9, 30, (h + 24 - 9) % 24)).toISOString();
    const a = activityOf([at(1), at(2), at(2), at(8), at(20)].map((createdAt) => ({ text: "あいう", createdAt, likes: 0 })));
    expect(a).toMatchObject({ count: 5, lateNightRate: 60, morningRate: 20, peakHour: 2, avgLength: 3 });
  });

  it("プロフィールに未成年を示す言葉があれば作らない", () => {
    expect(looksMinor({ ...MOCK_PROFILE, description: "高校生です" })).toBe(true);
    expect(looksMinor(MOCK_PROFILE)).toBe(false);
  });
});

describe("診断と彼をつくる", () => {
  const provider = (outputs: string[]): LLMProvider & { calls: GenerateRequest[] } => {
    const calls: GenerateRequest[] = [];
    return {
      name: "fake",
      calls,
      async *stream(req) {
        calls.push(req);
        yield outputs[Math.min(calls.length - 1, outputs.length - 1)];
      },
    };
  };
  const good = (patch: Record<string, unknown> = {}) =>
    JSON.stringify({
      type: "深夜の独り言職人",
      roasts: ["「寝る」から3時間後の「寝れない」、もう様式美", "コーヒー2杯まで、守れた日を見たことない", "喫茶店の店主の話、週3で出てくる"],
      sweet: "で、今夜は何時に寝るの。付き合うけど",
      plot: { ...toInput(getPlot("sleepy-prince")!), viewpoints: ["self", "watch"] },
      ...patch,
    });

  it("形が合えば、遊び方は「あなたが主人公」だけにして、タグに印を付ける", async () => {
    const r = await analyzeX(provider([good()]), MOCK_PROFILE, mockPosts());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.analysis.plot.viewpoints).toEqual(["self"]);
    expect(r.analysis.plot.tags.at(-1)).toBe(X_TAG);
    expect(r.analysis.roasts).toHaveLength(3);
  });

  it("使えない言葉の入ったツッコミは捨て、2つ未満なら作り直させる", async () => {
    const bad = good({ roasts: ["全裸で寝てそう", "コーヒー2杯まで、守れた日を見たことない"] });
    const p = provider([bad, good()]);
    const r = await analyzeX(p, MOCK_PROFILE, mockPosts());
    expect(r.ok).toBe(true);
    expect(p.calls).toHaveLength(2);
  });

  it("未成年のプロフィールでは、AI を呼ばずに止める", async () => {
    const p = provider([good()]);
    const r = await analyzeX(p, { ...MOCK_PROFILE, description: "JK2" }, mockPosts());
    expect(r).toEqual({ ok: false, error: "minor" });
    expect(p.calls).toHaveLength(0);
  });
});

describe("結果の保存", () => {
  it("作っている途中 → できた。同じ X アカウントの最近の結果を引ける。X の ID はハッシュで持つ", async () => {
    const xUser = await hashXUser("1234567890");
    expect(xUser).toMatch(/^[0-9a-f]{32}$/);
    expect(xUser).not.toContain("1234567890");
    const id = await createXResult("s1", xUser, "mio", { name: "みお" });
    expect((await getXResult(id))?.status).toBe("working");
    expect(await recentXResult(xUser, 60_000)).toBeNull();
    await finishXResult(id, "ready", { name: "みお", type: "深夜型", roasts: ["a", "b"], plotId: "u-abc" });
    expect((await recentXResult(xUser, 60_000))?.data.plotId).toBe("u-abc");
    expect(await countXToday()).toBe(1);
  });
});
