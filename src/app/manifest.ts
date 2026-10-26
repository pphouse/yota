import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "yota",
    short_name: "yota",
    description: "キャラクターと会話しながら物語を進めるチャットノベル。",
    start_url: "/",
    display: "standalone",
    background_color: "#0f0f13",
    theme_color: "#0f0f13",
    lang: "ja",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
