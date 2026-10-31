import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { addBlock, blockedAuthors, deleteAccount, listBlocks, removeBlock, savePushToken } from "./account";
import { query, resetDbForTests, run } from "./db";
import { addFeedback, addMessage, createConversation, logEvent } from "./store";

beforeEach(() => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "yota-acct-"));
  resetDbForTests(`file:${path.join(dir, "test.db")}`);
});

async function count(table: string, where = "1 = 1", args: string[] = []): Promise<number> {
  const rows = await query<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table} WHERE ${where}`, args);
  return Number(rows[0].n);
}

describe("退会（データの削除）", () => {
  it("本人のデータはすべて消え、他の人のデータは残る", async () => {
    for (const id of ["me", "other"]) {
      await run("INSERT INTO sessions (id, birth_year, birth_month, created_at) VALUES (?, 2000, 1, 0)", [id]);
      const conv = await createConversation(id, "sleepy-prince", "self");
      await addMessage(conv.id, "user", "こんにちは");
      await logEvent(id, "session_start");
      await addFeedback({ sessionId: id, kind: "note", category: "request", text: "感想" });
      await run(
        "INSERT INTO user_plots (id, session_id, data, created_at, updated_at) VALUES (?, ?, '{}', 0, 0)",
        [`u_${id}`, id],
      );
      await savePushToken(id, `token-${id}-0123456789abcdef`, "ios");
    }
    await addBlock("other", "me", "わたし");

    await deleteAccount("me");

    expect(await count("sessions", "id = ?", ["me"])).toBe(0);
    expect(await count("conversations", "session_id = ?", ["me"])).toBe(0);
    expect(await count("messages")).toBe(1);
    expect(await count("events", "session_id = ?", ["me"])).toBe(0);
    expect(await count("feedback", "session_id = ?", ["me"])).toBe(0);
    expect(await count("user_plots", "session_id = ?", ["me"])).toBe(0);
    expect(await count("push_tokens", "session_id = ?", ["me"])).toBe(0);
    // 自分をブロックしていた記録も残さない
    expect(await count("blocks")).toBe(0);
    expect(await count("sessions", "id = ?", ["other"])).toBe(1);
    expect(await count("user_plots", "session_id = ?", ["other"])).toBe(1);
  });
});

describe("作者のブロック", () => {
  it("同じ作者を二度ブロックしても1件で、解除できる", async () => {
    await addBlock("me", "author-1", "作者A");
    await addBlock("me", "author-1", "作者A");
    const items = await listBlocks("me");
    expect(items).toHaveLength(1);
    expect(items[0].author).toBe("作者A");
    expect(await blockedAuthors("me")).toEqual(new Set(["author-1"]));

    await removeBlock("other", items[0].id); // 他の人は解除できない
    expect(await listBlocks("me")).toHaveLength(1);
    await removeBlock("me", items[0].id);
    expect(await listBlocks("me")).toHaveLength(0);
  });
});

describe("通知の登録", () => {
  it("同じ端末を別のセッションで登録し直したら、新しいほうに付け替える", async () => {
    await savePushToken("a", "token-0123456789abcdef", "android");
    await savePushToken("b", "token-0123456789abcdef", "android");
    const rows = await query<{ session_id: string }>("SELECT session_id FROM push_tokens");
    expect(rows.map((r) => r.session_id)).toEqual(["b"]);
  });
});
