import type { MetadataRoute } from "next";
import { listArticles, SITE } from "@/lib/blog";
import { PLOTS } from "@/lib/characters";

/** 検索エンジン向けのサイトの地図。トップ・公式作品の紹介ページ・読みもの・規約など */
export default function sitemap(): MetadataRoute.Sitemap {
  const articles = listArticles();
  return [
    { url: SITE, changeFrequency: "daily", priority: 1 },
    { url: `${SITE}/blog`, lastModified: articles[0]?.updated, changeFrequency: "weekly", priority: 0.8 },
    ...articles.map((a) => ({ url: `${SITE}/blog/${a.slug}`, lastModified: a.updated, changeFrequency: "monthly" as const, priority: 0.7 })),
    ...PLOTS.map((p) => ({ url: `${SITE}/plot/${p.id}`, changeFrequency: "monthly" as const, priority: 0.6 })),
    ...["support", "terms", "privacy"].map((path) => ({ url: `${SITE}/${path}`, changeFrequency: "yearly" as const, priority: 0.2 })),
  ];
}
