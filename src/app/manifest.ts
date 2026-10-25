import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "yota — 推しと紡ぐ物語",
    short_name: "yota",
    description: "AIのキャラクターと、あなただけの物語を。",
    start_url: "/",
    display: "standalone",
    background_color: "#1b1630",
    theme_color: "#1b1630",
    lang: "ja",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
