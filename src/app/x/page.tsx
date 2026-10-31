import type { Metadata } from "next";
import { Suspense } from "react";
import { XStart } from "@/components/x/XStart";
import { xConfig } from "@/lib/x";

export const metadata: Metadata = {
  title: "Xから生まれる彼 — yota",
  description: "Xでログインすると、プロフィールと最近の投稿100件をAIが読んで、あなたのXのクセへのツッコミと、あなたに刺さる彼を作ります。",
};

export default function XPage() {
  // X のキーが入っているか（入っていなければ「準備中」にする）
  const available = xConfig() !== null;
  return (
    <Suspense fallback={<p className="mx-auto max-w-xl px-5 py-16 text-sm text-mist">読み込み中…</p>}>
      <XStart available={available} />
    </Suspense>
  );
}
