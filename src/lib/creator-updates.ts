/**
 * 作者募集のページ（/creators）の「作者さんの声で、変わったこと」。
 * いただいた声と、それで変わったことを、新しいものから上に足していく。空のあいだは、その欄ごと出さない。
 */
export type CreatorUpdate = {
  /** 例："2026-11-10" */
  date: string;
  /** いただいた声（要約でよい。個人が分かる言葉は書かない） */
  voice: string;
  /** それで変わったこと */
  change: string;
};

export const CREATOR_UPDATES: CreatorUpdate[] = [];
