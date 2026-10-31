import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { query, resetDbForTests } from "./db";
import { normalizeRef } from "./ref";
import { addFeedback } from "./store";

beforeEach(() => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "yota-fb-"));
  resetDbForTests(`file:${path.join(dir, "test.db")}`);
});

describe("流入元（?ref=）", () => {
  it("英小文字・数字・ハイフン・下線の40文字までだけを記録する", () => {
    expect(normalizeRef("zeta-x")).toBe("zeta-x");
    expect(normalizeRef(" Zeta_DM ")).toBe("zeta_dm");
    expect(normalizeRef("<script>")).toBe("");
    expect(normalizeRef("a".repeat(41))).toBe("");
    expect(normalizeRef(undefined)).toBe("");
  });
});

describe("フィードバックの保存", () => {
  it("同じ会話の評価は、送り直したら新しいものに置き換える", async () => {
    await addFeedback({ sessionId: "s1", kind: "rating", plotId: "sleepy-prince", conversationId: "c1", score: 3, turns: 6, ref: "zeta-x" });
    await addFeedback({ sessionId: "s1", kind: "rating", plotId: "sleepy-prince", conversationId: "c1", score: 5, compare: "better", turns: 8, ref: "zeta-x" });
    const rows = await query<{ score: number; compare: string; ref: string }>("SELECT score, compare, ref FROM feedback WHERE conversation_id = 'c1'");
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].score)).toBe(5);
    expect(rows[0].compare).toBe("better");
    expect(rows[0].ref).toBe("zeta-x");
  });

  it("ご意見は、年齢確認の前（セッションなし）でも保存できる", async () => {
    await addFeedback({ sessionId: null, kind: "note", category: "request", text: "BLの学園ものがもっとほしい", contact: "@example" });
    const rows = await query<{ kind: string; text: string }>("SELECT kind, text FROM feedback");
    expect(rows).toEqual([expect.objectContaining({ kind: "note", text: "BLの学園ものがもっとほしい" })]);
  });
});
