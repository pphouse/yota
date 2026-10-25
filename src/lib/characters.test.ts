import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { callName, PLOTS } from "./characters";
import { toBeats } from "./story";

const publicFile = (src: string) => path.join(import.meta.dirname, "../../public", src);

describe("公式の作品とキャラクター", () => {
  it("作品のIDが重複していない", () => {
    const ids = PLOTS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("登場人物は全員18歳以上", () => {
    for (const plot of PLOTS) for (const p of plot.personas) expect(p.age, `${plot.id} ${p.name}`).toBeGreaterThanOrEqual(18);
  });

  it("選べる視点ごとに、最初の一言と返事の候補がある", () => {
    for (const plot of PLOTS) {
      for (const v of plot.viewpoints) {
        expect(plot.opening[v], `${plot.id} ${v}`).toBeTruthy();
        expect(plot.starterReplies[v]?.length, `${plot.id} ${v}`).toBeGreaterThan(0);
      }
    }
  });

  it("表紙・背景・顔の絵のファイルがある", () => {
    for (const plot of PLOTS) {
      for (const src of [plot.cover, plot.backdrop, ...plot.personas.map((p) => p.face)]) {
        if (src) expect(existsSync(publicFile(src)), src).toBe(true);
      }
    }
  });

  it("ふたりの作品の最初の一言は、どの台詞も誰が話しているか分かる", () => {
    for (const plot of PLOTS.filter((p) => p.personas.length > 1)) {
      const names = plot.personas.map((p) => p.name);
      for (const v of plot.viewpoints) {
        const lines = toBeats(plot.opening[v]!, names).filter((b) => b.kind === "line");
        expect(lines.length, `${plot.id} ${v}`).toBeGreaterThan(0);
        for (const b of lines) expect(b.kind === "line" && b.speaker, `${plot.id} ${v}: ${b.text}`).not.toBeUndefined();
      }
    }
  });

  it("同じ作品の中で、呼び名が重ならない", () => {
    for (const plot of PLOTS) {
      const calls = plot.personas.map(callName);
      expect(new Set(calls).size, plot.id).toBe(calls.length);
    }
  });
});
