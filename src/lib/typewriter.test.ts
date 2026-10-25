import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CHAR_MS, costOf, pauseAfter, Typewriter } from "./typewriter";

describe("pauseAfter / costOf", () => {
  it("句点・閉じかっこ・読点・改行のあとに間を置く", () => {
    expect(pauseAfter("。", "次")).toBeGreaterThan(pauseAfter("、", "次"));
    expect(pauseAfter("」", "次")).toBeGreaterThan(0);
    expect(pauseAfter("\n", "次")).toBeGreaterThan(0);
    expect(pauseAfter("あ", "い")).toBe(0);
  });

  it("「……！？」のように続く記号の途中では間を置かない", () => {
    expect(pauseAfter("！", "？")).toBe(0);
    expect(pauseAfter("。", "」")).toBe(0);
    expect(pauseAfter("…", "…")).toBe(0);
  });

  it("最初の1文字と、画面に出ない * は待たない", () => {
    expect(costOf("こんばんは", 0)).toBe(0);
    expect(costOf("あ*い", 1)).toBe(0);
    expect(costOf("あい", 1)).toBe(CHAR_MS);
  });
});

describe("Typewriter", () => {
  let t = 0;
  const clock = {
    now: () => t,
    setTimer: (fn: () => void, ms: number) => setTimeout(fn, ms),
    clearTimer: (id: unknown) => clearTimeout(id as ReturnType<typeof setTimeout>),
  };
  beforeEach(() => {
    t = 0;
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  /** 時計とタイマーを ms だけ進める */
  function advance(ms: number) {
    for (let i = 0; i < ms; i += 10) {
      t += 10;
      vi.advanceTimersByTime(10);
    }
  }

  it("一度に届いた長文も、1文字ずつ決まった速さで見せる", () => {
    const seen: string[] = [];
    const tw = new Typewriter((s) => seen.push(s), clock);
    tw.push("あいうえおかきくけこ");
    expect(seen.at(-1)).toBe("あ"); // 最初の1文字はすぐ
    advance(CHAR_MS * 4);
    expect(seen.at(-1)!.length).toBeGreaterThanOrEqual(4);
    expect(seen.at(-1)!.length).toBeLessThan(10);
    advance(CHAR_MS * 10);
    expect(seen.at(-1)).toBe("あいうえおかきくけこ");
  });

  it("end() のあと、見せ終えたら done が解決する", async () => {
    const tw = new Typewriter(() => {}, clock);
    let finished = false;
    void tw.done.then(() => (finished = true));
    tw.push("あいう");
    tw.end();
    await Promise.resolve();
    expect(finished).toBe(false);
    advance(CHAR_MS * 5);
    await Promise.resolve();
    expect(finished).toBe(true);
  });

  it("flush() で残りを一気に見せる", async () => {
    const seen: string[] = [];
    const tw = new Typewriter((s) => seen.push(s), clock);
    tw.push("長い返答の続き");
    tw.end();
    tw.flush();
    expect(seen.at(-1)).toBe("長い返答の続き");
    await expect(tw.done).resolves.toBeUndefined();
  });

  it("replace() は差し替えた全文をすぐに見せる", () => {
    const seen: string[] = [];
    const tw = new Typewriter((s) => seen.push(s), clock);
    tw.push("途中まで");
    tw.replace("*（表示できません）*");
    expect(seen.at(-1)).toBe("*（表示できません）*");
  });

  it("rewrite() は同じところまで残し、違うところから打ち直す", async () => {
    const seen: string[] = [];
    const tw = new Typewriter((s) => seen.push(s), clock);
    tw.push("マスクの耳挂を");
    advance(CHAR_MS * 20);
    expect(seen.at(-1)).toBe("マスクの耳挂を");
    tw.rewrite("マスクのひもを摘む");
    expect(seen.at(-1)).toBe("マスクの");
    tw.end();
    advance(CHAR_MS * 20);
    expect(seen.at(-1)).toBe("マスクのひもを摘む");
    await expect(tw.done).resolves.toBeUndefined();
  });

  it("届くのを待っていたあいだの時間を貯めず、次に届いた分も同じ速さで見せる", () => {
    const seen: string[] = [];
    const tw = new Typewriter((s) => seen.push(s), clock);
    tw.push("あ");
    advance(2000); // 次が届くまで2秒あく
    tw.push("いうえおかきくけこ");
    advance(CHAR_MS * 2);
    expect(seen.at(-1)!.length).toBeLessThan(6);
  });

  it("cancel() で止めると、それ以上は更新せず done が解決する", async () => {
    const seen: string[] = [];
    const tw = new Typewriter((s) => seen.push(s), clock);
    tw.push("あいうえお");
    tw.cancel();
    const n = seen.length;
    advance(500);
    expect(seen.length).toBe(n);
    await expect(tw.done).resolves.toBeUndefined();
  });
});
