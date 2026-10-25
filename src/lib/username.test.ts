import { describe, expect, it } from "vitest";
import { nameInNarration, nameInProse, normalizeUserName, USER_NAME_MAX } from "./username";

describe("normalizeUserName", () => {
  it("前後の空白と、物語の書式に使う記号を取り除く", () => {
    expect(normalizeUserName("  zettai ")).toBe("zettai");
    expect(normalizeUserName("*みお*「」")).toBe("みお");
    expect(normalizeUserName("ゆ  な")).toBe("ゆ な");
  });

  it("空・長すぎる・安全でない名前は受け付けない", () => {
    expect(normalizeUserName("   ")).toBeNull();
    expect(normalizeUserName("あ".repeat(USER_NAME_MAX + 1))).toBeNull();
    expect(normalizeUserName("セックス")).toBeNull();
  });
});

describe("nameInNarration / nameInProse", () => {
  it("地の文の「あなた」だけを名前にし、台詞の呼びかけは残す", () => {
    expect(nameInNarration("*ちらりとあなたを見上げる* あなたは、どう思う？", "zettai")).toBe("*ちらりとzettaiを見上げる* あなたは、どう思う？");
    expect(nameInProse("あなたは睡眠外来の検査技師。", "zettai")).toBe("zettaiは睡眠外来の検査技師。");
  });

  it("名前がなければ、そのまま", () => {
    expect(nameInNarration("*あなたを見る*", "")).toBe("*あなたを見る*");
  });
});
