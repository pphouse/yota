"use client";

import { useEffect } from "react";
import { track } from "@/lib/client";
import { captureRef } from "@/lib/ref";

/** 募集の投稿などのリンク（?ref=zeta-x）から来た人を記録する。画面には何も出さない */
export function RefCapture() {
  useEffect(() => {
    const ref = captureRef(window.location.search);
    if (ref) track("landing_view", { ref, path: window.location.pathname });
  }, []);
  return null;
}
