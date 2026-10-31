"use client";

import { useEffect, useState } from "react";
import { Shelf } from "@/components/Shelf";
import { callName, PLOTS } from "@/lib/characters";
import { getSessionInfo } from "@/lib/client";
import { recommend } from "@/lib/recommend";

/**
 * 「あなたにおすすめ」。遊んだ作品から、まだ遊んでいない作品を選ぶ。
 * まだ何も遊んでいない（または確認前の）人には、入口の作品を「はじめての方におすすめ」として出す
 */
export function ForYou() {
  const [played, setPlayed] = useState<string[]>([]);

  useEffect(() => {
    void getSessionInfo().then((info) => {
      if (info?.played?.length) setPlayed(info.played);
    });
  }, []);

  const picks = recommend(PLOTS, played);
  const personal = picks.some((p) => p.because);
  const notes = Object.fromEntries(
    picks.filter((p) => p.because).map((p) => [p.plot.id, `${p.because!.personas.map(callName).join("と")}の物語を遊んだあなたに`]),
  );
  return <Shelf title={personal ? "あなたにおすすめ" : "はじめての方におすすめ"} plots={picks.map((p) => p.plot)} notes={notes} />;
}
