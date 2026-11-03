import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { completeLogin, emailEnabled, enabledProviders, fromApp, guestLimited } from "./auth";
import { query, resetDbForTests } from "./db";
import { CODE_TTL_MS, codeMail, LIMITS, makeCode, MAX_TRIES, normalizeEmail, sendLoginCode, verifyLoginCode, type Mailer } from "./email-login";

beforeEach(() => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "yota-email-"));
  resetDbForTests(`file:${path.join(dir, "test.db")}`);
});

/** 送ったコードを横取りする、テスト用の送り手 */
function catcher() {
  const sent: { to: string; code: string }[] = [];
  const mailer: Mailer = async (to, code) => {
    sent.push({ to, code });
  };
  return { sent, mailer, last: () => sent.at(-1)!.code };
}

const T0 = 1_800_000_000_000;

describe("メールアドレスとコードの形", () => {
  it("アドレスは小文字・全角を半角にそろえ、正しくないものは通さない", () => {
    expect(normalizeEmail("  Mio@Example.COM ")).toBe("mio@example.com");
    expect(normalizeEmail("ｍｉｏ＠ｅｘａｍｐｌｅ．ｃｏｍ")).toBe("mio@example.com");
    expect(normalizeEmail("mio@example")).toBeNull();
    expect(normalizeEmail("mio example.com")).toBeNull();
    expect(normalizeEmail("<a>@example.com")).toBeNull();
    expect(normalizeEmail(42)).toBeNull();
  });

  it("コードはいつも6けたの数字", () => {
    for (let i = 0; i < 200; i++) expect(makeCode()).toMatch(/^\d{6}$/);
  });

  it("件名と本文にコードが入る", () => {
    const m = codeMail("012345");
    expect(m.subject).toContain("012345");
    expect(m.text).toContain("012345");
    expect(m.html).toContain("012345");
  });
});

describe("コードを送って確かめる", () => {
  it("届いたコードでログインできる。同じコードは2回使えない", async () => {
    const c = catcher();
    expect(await sendLoginCode("mio@example.com", "ip1", c.mailer, T0)).toEqual({ ok: true });
    expect(c.sent[0].to).toBe("mio@example.com");
    expect(await verifyLoginCode("mio@example.com", c.last(), T0 + 1000)).toEqual({ ok: true });
    expect(await verifyLoginCode("mio@example.com", c.last(), T0 + 2000)).toEqual({ ok: false, error: "expired" });
  });

  it("全角の数字や空白が混じっていても通す", async () => {
    const c = catcher();
    await sendLoginCode("mio@example.com", "ip1", c.mailer, T0);
    const wide = c.last().replace(/\d/g, (d) => String.fromCharCode(d.charCodeAt(0) + 0xfee0));
    expect(await verifyLoginCode("mio@example.com", ` ${wide.slice(0, 3)} ${wide.slice(3)}`, T0 + 1000)).toEqual({ ok: true });
  });

  it("まちがいは5回まで。そのあとは正しいコードでも使えない", async () => {
    const c = catcher();
    await sendLoginCode("mio@example.com", "ip1", c.mailer, T0);
    const wrong = c.last() === "000000" ? "111111" : "000000";
    for (let i = 1; i < MAX_TRIES; i++) expect(await verifyLoginCode("mio@example.com", wrong, T0)).toEqual({ ok: false, error: "wrong", left: MAX_TRIES - i });
    expect(await verifyLoginCode("mio@example.com", wrong, T0)).toEqual({ ok: false, error: "too_many" });
    expect(await verifyLoginCode("mio@example.com", c.last(), T0)).toEqual({ ok: false, error: "too_many" });
  });

  it("10分たつと使えない。送り直すと前のコードは使えなくなる", async () => {
    const c = catcher();
    await sendLoginCode("mio@example.com", "ip1", c.mailer, T0);
    expect(await verifyLoginCode("mio@example.com", c.last(), T0 + CODE_TTL_MS + 1)).toEqual({ ok: false, error: "expired" });
    const first = c.last();
    await sendLoginCode("mio@example.com", "ip1", c.mailer, T0 + 2 * 60_000);
    if (first !== c.last()) expect((await verifyLoginCode("mio@example.com", first, T0 + 3 * 60_000)).ok).toBe(false);
    expect(await verifyLoginCode("mio@example.com", c.last(), T0 + 3 * 60_000)).toEqual({ ok: true });
  });

  it("ほかのアドレスのコードでは入れない", async () => {
    const c = catcher();
    await sendLoginCode("a@example.com", "ip1", c.mailer, T0);
    expect((await verifyLoginCode("b@example.com", c.last(), T0)).ok).toBe(false);
  });

  it("メールアドレスもコードも、そのままの形では保存しない", async () => {
    const c = catcher();
    await sendLoginCode("mio@example.com", "ip1", c.mailer, T0);
    const rows = await query<Record<string, unknown>>("SELECT * FROM email_codes");
    expect(JSON.stringify(rows)).not.toContain("mio@example.com");
    expect(JSON.stringify(rows)).not.toContain(c.last());
  });
});

describe("送りすぎを防ぐ", () => {
  it("同じアドレスへは1分あけて、1時間に5通まで", async () => {
    const c = catcher();
    expect((await sendLoginCode("mio@example.com", "ip1", c.mailer, T0)).ok).toBe(true);
    expect(await sendLoginCode("mio@example.com", "ip1", c.mailer, T0 + 30_000)).toEqual({ ok: false, error: "wait" });
    for (let i = 1; i < LIMITS.perEmailPerHour; i++) expect((await sendLoginCode("mio@example.com", `ip${i + 1}`, c.mailer, T0 + i * 61_000)).ok).toBe(true);
    expect(await sendLoginCode("mio@example.com", "ip9", c.mailer, T0 + 10 * 61_000)).toEqual({ ok: false, error: "too_many" });
    expect(c.sent).toHaveLength(LIMITS.perEmailPerHour);
  });

  it("同じ接続元からは、1時間に10通まで", async () => {
    const c = catcher();
    for (let i = 0; i < LIMITS.perIpPerHour; i++) expect((await sendLoginCode(`u${i}@example.com`, "ip1", c.mailer, T0 + i)).ok).toBe(true);
    expect(await sendLoginCode("u99@example.com", "ip1", c.mailer, T0 + 100)).toEqual({ ok: false, error: "too_many" });
  });

  it("送れなかったら、数えずに失敗を返す", async () => {
    const broken: Mailer = async () => {
      throw new Error("down");
    };
    expect(await sendLoginCode("mio@example.com", "ip1", broken, T0)).toEqual({ ok: false, error: "failed" });
    expect((await sendLoginCode("mio@example.com", "ip1", catcher().mailer, T0 + 1000)).ok).toBe(true);
  });
});

describe("アプリとゲストの上限", () => {
  const app = new Request("https://yotachat.app/api/chat", { headers: { "user-agent": "Mozilla/5.0 (iPhone) AppleWebKit/605 YotaApp" } });
  const web = new Request("https://yotachat.app/api/chat", { headers: { "user-agent": "Mozilla/5.0 (iPhone) Safari/604" } });

  it("アプリの人には上限をかけない。Web はログインが使えるときだけかける", () => {
    expect(fromApp(app)).toBe(true);
    expect(fromApp(web)).toBe(false);
    const keys = { GOOGLE_CLIENT_ID: "g", GOOGLE_CLIENT_SECRET: "s" };
    expect(guestLimited(web, keys)).toBe(true);
    expect(guestLimited(app, keys)).toBe(false);
    expect(guestLimited(web, {})).toBe(false);
  });

  it("メールは送るためのキーがあれば使える。試すための EMAIL_MOCK は本番では効かない", () => {
    expect(emailEnabled({ RESEND_API_KEY: "re_x" })).toBe(true);
    expect(emailEnabled({ EMAIL_MOCK: "1" })).toBe(true);
    expect(emailEnabled({ EMAIL_MOCK: "1", VERCEL_ENV: "production" })).toBe(false);
    expect(enabledProviders({ RESEND_API_KEY: "re_x", GOOGLE_CLIENT_ID: "g", GOOGLE_CLIENT_SECRET: "s" })).toEqual(["google", "email"]);
  });

  it("同じメールアドレスなら、別の端末でも同じアカウントに戻れる", async () => {
    const { run } = await import("./db");
    await run("INSERT INTO sessions (id, birth_year, birth_month, created_at) VALUES ('acc', 2000, 1, 0)");
    expect(await completeLogin("email", "mio@example.com", "acc")).toMatchObject({ ok: true, isNew: true });
    expect(await completeLogin("email", "mio@example.com", null)).toEqual({ ok: true, sessionId: "acc", isNew: false });
  });
});
