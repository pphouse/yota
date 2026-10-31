import { useSyncExternalStore } from "react";

// 画面を開いた時刻。ページは前もって作っておく（静的）ので、日付で変わる表示（NEW など）は、ブラウザで開いてから決める
const openedAt = Date.now();
const subscribe = () => () => {};

/** ブラウザでは画面を開いた時刻、サーバーで作るときは null（null の間は日付で変わる表示を出さない） */
export function useNow(): number | null {
  return useSyncExternalStore(
    subscribe,
    () => openedAt,
    () => null,
  );
}
