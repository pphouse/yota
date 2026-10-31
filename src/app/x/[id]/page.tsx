import type { Metadata } from "next";
import { Suspense } from "react";
import { XResultView } from "@/components/x/XResultView";

export const metadata: Metadata = {
  title: "Xから生まれる彼 — yota",
  description: "Xの投稿から、AIがあなたのXを診断して、あなたに刺さる彼を作りました。",
  twitter: { card: "summary_large_image" },
};

/** 「Xから生まれる彼」の結果。シェアされたリンクから開かれる（中身は画面で取りに行く） */
export default function XResultPage() {
  return (
    <Suspense fallback={<p className="mx-auto max-w-xl px-5 py-16 text-sm text-mist">読み込み中…</p>}>
      <XResultView />
    </Suspense>
  );
}
