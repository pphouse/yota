import type { Metadata } from "next";
import { Suspense } from "react";
import { CreatePlot } from "@/components/CreatePlot";

export const metadata: Metadata = { title: "作品をつくる — yota" };

export default function CreatePage() {
  // 直すときは ?id= で作品を選ぶ（URL の値を読むので Suspense で包む）
  return (
    <Suspense fallback={<p className="px-5 py-16 text-sm text-mist">読み込み中…</p>}>
      <CreatePlot />
    </Suspense>
  );
}
