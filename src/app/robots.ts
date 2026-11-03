import type { MetadataRoute } from "next";
import { SITE } from "@/lib/blog";

/** 検索エンジンに、会話や管理の画面など、検索に出す意味のないページを読ませない */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/chat/", "/create", "/settings"] },
    sitemap: `${SITE}/sitemap.xml`,
  };
}
