import type { Plot } from "./characters";

/** まだ何も遊んでいない人に出す、編集部が選んだ入口の作品（キャラが話を引っ張ってくれて、始めやすいもの） */
export const STARTER_PICKS = ["puppy-junior", "sleepy-prince", "idol-neighbor", "bakery-3am", "sticker-book", "festival-chair"];

export type Pick = { plot: Plot; because?: Plot };

/**
 * 遊んだ作品（新しい順）から、まだ遊んでいない作品を選ぶ。
 * カテゴリが同じなら2点、タグが同じなら1点、見守りの作品どうしなら1点を、最近遊んだものほど重く足す。
 * 一番点を足した遊んだ作品を「〜を遊んだあなたに」の理由にする。足りない分は、入口の作品で埋める。
 */
export function recommend(plots: Plot[], played: string[], limit = 6): Pick[] {
  const playedPlots = played.map((id) => plots.find((p) => p.id === id)).filter((p): p is Plot => Boolean(p));
  const seen = new Set(playedPlots.map((p) => p.id));
  const scored = plots
    .filter((p) => !seen.has(p.id))
    .map((candidate, order) => {
      let score = 0;
      let because: Plot | undefined;
      let best = 0;
      playedPlots.forEach((mine, i) => {
        const weight = 1 / (1 + i);
        const s =
          weight *
          (2 * candidate.genres.filter((g) => mine.genres.includes(g)).length +
            candidate.tags.filter((t) => mine.tags.includes(t)).length +
            (candidate.viewpoints.includes("watch") && mine.viewpoints.includes("watch") ? 1 : 0));
        score += s;
        if (s > best) {
          best = s;
          because = mine;
        }
      });
      return { plot: candidate, because, score, order };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.order - b.order);
  const picks: Pick[] = scored.slice(0, limit).map(({ plot, because }) => ({ plot, because }));
  for (const id of STARTER_PICKS) {
    if (picks.length >= limit) break;
    const plot = plots.find((p) => p.id === id);
    if (plot && !seen.has(id) && !picks.some((x) => x.plot.id === id)) picks.push({ plot });
  }
  return picks;
}
