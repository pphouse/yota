import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deleteAccount } from "./account";
import {
  accountOf,
  appleClientSecret,
  authEnabled,
  authorizeUrl,
  checkClaims,
  completeLogin,
  enabledProviders,
  exchangeCode,
  guestLimit,
  isLoggedIn,
  safeReturn,
  sentMessages,
} from "./auth";
import { query, resetDbForTests, run } from "./db";
import { addMessage, createConversation, getLatestConversation } from "./store";

beforeEach(() => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "yota-auth-"));
  resetDbForTests(`file:${path.join(dir, "test.db")}`);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const b64url = (v: string | ArrayBuffer) => Buffer.from(typeof v === "string" ? Buffer.from(v) : new Uint8Array(v)).toString("base64url");

async function hs256Token(secret: string, payload: Record<string, unknown>): Promise<string> {
  const head = `${b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }))}.${b64url(JSON.stringify(payload))}`;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return `${head}.${b64url(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(head)))}`;
}

async function newSession(id: string) {
  await run("INSERT INTO sessions (id, birth_year, birth_month, created_at) VALUES (?, 2000, 1, 0)", [id]);
}

async function count(table: string, where: string, args: string[]): Promise<number> {
  return Number((await query<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table} WHERE ${where}`, args))[0].n);
}

describe("ログインの設定", () => {
  it("キーがそろったものだけが使える。ひとつもなければゲストの上限もかけない", () => {
    expect(enabledProviders({})).toEqual([]);
    expect(authEnabled({})).toBe(false);
    expect(enabledProviders({ LINE_CHANNEL_ID: "1", LINE_CHANNEL_SECRET: "s" })).toEqual(["line"]);
    // Apple は4つそろわないと使えない
    expect(enabledProviders({ APPLE_SIGNIN_CLIENT_ID: "app.yotachat.web", APPLE_TEAM_ID: "T" })).toEqual([]);
    expect(guestLimit({})).toBe(15);
    expect(guestLimit({ GUEST_MESSAGE_LIMIT: "3" })).toBe(3);
  });

  it("戻り先は同じサイトの中だけ", () => {
    expect(safeReturn("/chat/sleepy-prince?v=self")).toBe("/chat/sleepy-prince?v=self");
    expect(safeReturn("https://evil.example")).toBe("/");
    expect(safeReturn("//evil.example")).toBe("/");
    expect(safeReturn("/api/session")).toBe("/");
    expect(safeReturn(null)).toBe("/");
  });

  it("ログインの画面には ID だけを求める（メールは求めない）", () => {
    const o = { redirectUri: "https://yotachat.app/api/auth/x/callback", state: "st", nonce: "no", challenge: "ch" };
    const google = new URL(authorizeUrl({ provider: "google", clientId: "g", clientSecret: "s" }, o));
    expect(google.searchParams.get("scope")).toBe("openid");
    expect(google.searchParams.get("code_challenge_method")).toBe("S256");
    const apple = new URL(authorizeUrl({ provider: "apple", clientId: "a", teamId: "t", keyId: "k", privateKey: "p" }, o));
    expect(apple.searchParams.get("scope")).toBeNull();
    expect(apple.searchParams.get("response_mode")).toBe("query");
    const line = new URL(authorizeUrl({ provider: "line", clientId: "l", clientSecret: "s" }, o));
    expect(line.searchParams.get("nonce")).toBe("no");
  });
});

describe("id_token の確かめ", () => {
  const ok = { iss: "https://access.line.me", aud: "123", sub: "U1", exp: Math.floor(Date.now() / 1000) + 600, nonce: "n" };
  const opt = { iss: ["https://access.line.me"], aud: "123", nonce: "n" };

  it("正しければ sub を返す", () => {
    expect(checkClaims(ok, opt)).toBe("U1");
  });

  it("発行元・宛先・期限・nonce が違えば通さない", () => {
    expect(() => checkClaims({ ...ok, iss: "https://evil" }, opt)).toThrow();
    expect(() => checkClaims({ ...ok, aud: "999" }, opt)).toThrow();
    expect(() => checkClaims({ ...ok, exp: Math.floor(Date.now() / 1000) - 3600 }, opt)).toThrow();
    expect(() => checkClaims({ ...ok, nonce: "x" }, opt)).toThrow();
    expect(() => checkClaims({ ...ok, sub: undefined }, opt)).toThrow();
  });

  it("LINE はチャネルシークレットの署名を確かめる", async () => {
    const cfg = { provider: "line" as const, clientId: "123", clientSecret: "secret" };
    const good = await hs256Token("secret", ok);
    const forged = await hs256Token("other", ok);
    const reply = (token: string) => vi.fn(async () => new Response(JSON.stringify({ id_token: token }), { status: 200 }));
    const args = { code: "c", redirectUri: "https://yotachat.app/api/auth/line/callback", verifier: "v", nonce: "n" };

    vi.stubGlobal("fetch", reply(good));
    expect(await exchangeCode(cfg, args)).toBe("U1");
    vi.stubGlobal("fetch", reply(forged));
    await expect(exchangeCode(cfg, args)).rejects.toThrow();
  });

  it("トークンを受け取れなければ失敗にする", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 })));
    await expect(
      exchangeCode({ provider: "google", clientId: "g", clientSecret: "s" }, { code: "c", redirectUri: "r", verifier: "v", nonce: "n" }),
    ).rejects.toThrow();
  });

  it("Apple の client_secret は .p8 の鍵で ES256 署名する", async () => {
    const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
    const pkcs8 = Buffer.from(await crypto.subtle.exportKey("pkcs8", pair.privateKey)).toString("base64");
    // Vercel に入れるときは改行を \n と書くこともあるので、その形でも読めること
    const pem = `-----BEGIN PRIVATE KEY-----\\n${pkcs8.match(/.{1,64}/g)!.join("\\n")}\\n-----END PRIVATE KEY-----`;
    const jwt = await appleClientSecret({ provider: "apple", clientId: "app.yotachat.web", teamId: "TEAM123", keyId: "KEY123", privateKey: pem }, 1_700_000_000_000);
    const [h, p, s] = jwt.split(".");
    expect(JSON.parse(Buffer.from(h, "base64url").toString())).toEqual({ alg: "ES256", kid: "KEY123" });
    expect(JSON.parse(Buffer.from(p, "base64url").toString())).toMatchObject({ iss: "TEAM123", sub: "app.yotachat.web", aud: "https://appleid.apple.com", iat: 1_700_000_000 });
    const valid = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, pair.publicKey, Buffer.from(s, "base64url"), new TextEncoder().encode(`${h}.${p}`));
    expect(valid).toBe(true);
  });
});

describe("ログインとゲストの記録", () => {
  it("はじめてのアカウントは、いまのセッションに結びつく（ゲストの会話はそのまま）", async () => {
    await newSession("guest");
    const conv = await createConversation("guest", "sleepy-prince", "self");
    await addMessage(conv.id, "user", "こんにちは");
    expect(await sentMessages("guest")).toBe(1);
    expect(await isLoggedIn("guest")).toBe(false);

    const r = await completeLogin("line", "U-line-1", "guest");
    expect(r).toEqual({ ok: true, sessionId: "guest", isNew: true });
    expect(await accountOf("guest")).toEqual(["line"]);
    // 外部の ID はそのまま持たない
    expect(await count("identities", "subject = ?", ["U-line-1"])).toBe(0);
  });

  it("前にログインしたアカウントなら、そちらに切りかえ、ゲストの会話を移す", async () => {
    await newSession("account");
    await completeLogin("google", "G-1", "account");
    await newSession("guest");
    const conv = await createConversation("guest", "dorm-rivals", "self");
    await addMessage(conv.id, "user", "はじめまして");

    const r = await completeLogin("google", "G-1", "guest");
    expect(r).toEqual({ ok: true, sessionId: "account", isNew: false });
    expect((await getLatestConversation("account", "dorm-rivals", "self"))?.id).toBe(conv.id);
    expect(await count("sessions", "id = ?", ["guest"])).toBe(0);
  });

  it("別のアカウントでログイン中なら、混ぜずに切りかえるだけ", async () => {
    await newSession("a");
    await completeLogin("line", "L-a", "a");
    await createConversation("a", "sleepy-prince", "self");
    await newSession("b");
    await completeLogin("apple", "A-b", "b");

    const r = await completeLogin("apple", "A-b", "a");
    expect(r).toEqual({ ok: true, sessionId: "b", isNew: false });
    expect(await count("conversations", "session_id = ?", ["a"])).toBe(1);
    expect(await accountOf("a")).toEqual(["line"]);
  });

  it("年齢の確認の前（セッションなし）のはじめての人は、先に年齢を確かめる", async () => {
    expect(await completeLogin("line", "new-person", null)).toEqual({ ok: false, error: "needs_age" });
    // 前にログインした人なら、年齢の確認なしで戻れる
    await newSession("acc");
    await completeLogin("line", "returning", "acc");
    expect(await completeLogin("line", "returning", null)).toEqual({ ok: true, sessionId: "acc", isNew: false });
  });

  it("退会すると、ログインのつながりも消える", async () => {
    await newSession("me");
    await completeLogin("google", "G-me", "me");
    await deleteAccount("me");
    expect(await count("identities", "session_id = ?", ["me"])).toBe(0);
    expect(await completeLogin("google", "G-me", null)).toEqual({ ok: false, error: "needs_age" });
  });
});
