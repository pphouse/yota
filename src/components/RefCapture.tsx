"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { track } from "@/lib/client";
import { captureRef, captureSource } from "@/lib/ref";

/**
 * どこから来た人かを記録する。画面には何も出さない。
 * - 入口：Google 検索・ChatGPT・Claude など（utm_source かリファラーから。最初の1回だけ）
 * - ?ref=：募集の投稿や記事のボタンなどのリンク（例 ?ref=blog-zeta-hikkoshi）
 * 記事のボタンはページ内の移動になることがあるので、ページが変わるたびに確かめる。
 */
export function RefCapture() {
  const pathname = usePathname();
  useEffect(() => {
    const src = captureSource(window.location.search, document.referrer, window.location.hostname);
    const ref = captureRef(window.location.search);
    if (src || ref) track("landing_view", { ref: ref ?? "", src: src ?? "", path: window.location.pathname });
  }, [pathname]);
  return null;
}
