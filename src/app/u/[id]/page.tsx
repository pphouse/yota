import { Suspense } from "react";
import { UgcPlotView } from "@/components/UgcPlotView";

/** ユーザーが作った作品の紹介ページ（中身は画面で取りに行く） */
export default function UgcPage() {
  return (
    <Suspense fallback={<p className="mx-auto max-w-xl px-5 py-16 text-sm text-mist">読み込み中…</p>}>
      <UgcPlotView />
    </Suspense>
  );
}
