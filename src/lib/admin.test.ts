import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { getPlot } from "./characters";
import { adminEnabled, checkPassword, makeToken, verifyToken } from "./admin";
import { costSummary, startOfTodayJst, stats, worksList } from "./admin-data";
import { resetDbForTests, run } from "./db";
import { createUgc, getUgc, listUgc, setOfficial, setUgcStatus } from "./ugc";
import { toInput } from "./ugc-draft";

beforeEach(() => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "yota-admin-"));
  resetDbForTests(`file:${path.join(dir, "test.db")}`);
});

describe("管理者のログイン", () => {
  it("パスワードが8文字以上入っているときだけ使える", () => {
    expect(adminEnabled({})).toBe(false);
    expect(adminEnabled({ ADMIN_PASSWORD: "short" })).toBe(false);
    expect(adminEnabled({ ADMIN_PASSWORD: "long-enough-pass" })).toBe(true);
  });

  it("パスワードを比べ、署名した期限つきの印を確かめる。期限切れ・パスワード変更・書きかえは通さない", async () => {
    const pw = "correct horse battery";
    expect(await checkPassword(pw, pw)).toBe(true);
    expect(await checkPassword("wrong", pw)).toBe(false);
    expect(await checkPassword(pw, "")).toBe(false);
    const now = Date.now();
    const token = await makeToken(now, pw);
    expect(await verifyToken(token, now + 1000, pw)).toBe(true);
    expect(await verifyToken(token, now + 8 * 24 * 3600 * 1000, pw)).toBe(false);
    expect(await verifyToken(token, now, "changed password")).toBe(false);
    const [exp, sig] = token.split(".");
    expect(await verifyToken(`${Number(exp) + 999999}.${sig}`, now, pw)).toBe(false);
    expect(await verifyToken(undefined, now, pw)).toBe(false);
  });
});

describe("運営の作品", () => {
  const input = () => toInput(getPlot("sleepy-prince")!);

  it("運営の作品は確認なしで公開され、「新作」の一覧にだけ出る（みんなの作品には出ない）", async () => {
    const official = await createUgc("admin", "yota", input(), "none", { official: true });
    const user = await createUgc("s1", "みお", input(), "none");
    await setUgcStatus(user, "public");
    expect((await getUgc(official))?.meta).toMatchObject({ status: "public", official: true });
    expect((await listUgc({ status: "public", official: true })).map((e) => e.meta.id)).toEqual([official]);
    expect((await listUgc({ status: "public", official: false })).map((e) => e.meta.id)).toEqual([user]);
    await setOfficial(user, true);
    expect((await listUgc({ status: "public", official: true })).map((e) => e.meta.id).sort()).toEqual([official, user].sort());
  });

  it("管理者画面の一覧は、止めた作品も見られ、通報の数を添える", async () => {
    const id = await createUgc("s1", "みお", input(), "none");
    await setUgcStatus(id, "removed");
    await run("INSERT INTO feedback (id, session_id, kind, category, text, created_at) VALUES ('f1', 's2', 'note', 'report', ?, ?)", [`未成年に見える（${id}）`, Date.now()]);
    const removed = await worksList("removed");
    expect(removed.map((w) => [w.id, w.status, w.reports])).toEqual([[id, "removed", 1]]);
    expect((await worksList("all")).length).toBe(1);
    expect(await worksList("pending")).toEqual([]);
  });
});

describe("管理者画面の数字", () => {
  it("今日（日本時間）と7日間の数を数え、申請の数を出す", async () => {
    const now = Date.now();
    await run("INSERT INTO sessions (id, birth_year, birth_month, created_at) VALUES ('s1', 1998, 6, ?)", [now]);
    await run("INSERT INTO conversations (id, session_id, plot_id, viewpoint, created_at, updated_at) VALUES ('c1', 's1', 'sleepy-prince', 'self', ?, ?)", [now, now]);
    await run("INSERT INTO messages (id, conversation_id, seq, role, content, created_at) VALUES ('m1', 'c1', 1, 'user', 'こんばんは', ?)", [now]);
    await run("INSERT INTO feedback (id, session_id, kind, score, created_at) VALUES ('r1', 's1', 'rating', 4, ?)", [now]);
    const id = await createUgc("s1", "みお", toInput(getPlot("sleepy-prince")!), "none");
    await setUgcStatus(id, "pending");
    const s = await stats(now);
    expect(s.today).toMatchObject({ newUsers: 1, activeUsers: 1, conversations: 1, messages: 1, ratings: 1, ratingAvg: 4, works: 1 });
    expect(s.pending).toBe(1);
    expect(s.topPlots[0]).toMatchObject({ plotId: "sleepy-prince", title: getPlot("sleepy-prince")!.title, users: 1 });
    expect(startOfTodayJst(Date.UTC(2026, 10, 3, 16, 0))).toBe(Date.UTC(2026, 10, 3, 15, 0));
  });

  it("文章AIの費用を日ごと・用途ごとにまとめる", async () => {
    const now = Date.now();
    await run("INSERT INTO llm_usage (purpose, provider, model, ms, status, cost_usd, created_at) VALUES ('chat', 'openai', 'm', 100, 'ok', 0.01, ?)", [now]);
    await run("INSERT INTO llm_usage (purpose, provider, model, ms, status, cost_usd, created_at) VALUES ('suggest', 'openai', 'm', 100, 'ok', 0.002, ?)", [now]);
    const c = await costSummary(7, now);
    expect(c.calls).toBe(2);
    expect(c.days).toHaveLength(7);
    expect(c.purposes.map((p) => p.purpose)).toEqual(["chat", "suggest"]);
    expect(c.totalYen).toBe(Math.round(0.012 * 150));
  });
});
