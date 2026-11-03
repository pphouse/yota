import type { Metadata } from "next";
import Link from "next/link";
import { BlogShell } from "@/components/blog/BlogShell";
import { jaDate, listArticles, SITE } from "@/lib/blog";

export const metadata: Metadata = {
  title: "読みもの — yota",
  description: "AIキャラチャットの使い方・料金・年齢制限・乗り換え、AIで夢小説を楽しむ方法など。AIキャラと話す物語のアプリ yota の運営がまとめています。",
  alternates: { canonical: "/blog" },
  openGraph: { type: "website", url: "/blog", title: "読みもの — yota", siteName: "yota", locale: "ja_JP" },
};

/** 読みものの一覧 */
export default function BlogIndex() {
  const articles = listArticles();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "yota 読みもの",
    url: `${SITE}/blog`,
    inLanguage: "ja",
    publisher: { "@type": "Organization", name: "yota", url: SITE },
    blogPost: articles.map((a) => ({ "@type": "BlogPosting", headline: a.title, url: `${SITE}/blog/${a.slug}`, datePublished: a.published, dateModified: a.updated })),
  };
  return (
    <BlogShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <h1 className="mt-6 text-[1.6rem] font-black leading-snug">読みもの</h1>
      <p className="mt-2 text-[0.9rem] leading-7 text-paper/80">
        AIキャラチャットの使い方や選び方、AIで物語を楽しむコツを、AIキャラと話す物語のアプリ yota の運営がまとめています。
      </p>
      <ul className="mt-8 space-y-3">
        {articles.map((a) => (
          <li key={a.slug}>
            <Link href={`/blog/${a.slug}`} className="press block rounded-3xl bg-night-2 p-5 hover:bg-night-3">
              <h2 className="text-[1.05rem] font-black leading-snug">{a.title}</h2>
              <p className="mt-2 line-clamp-3 text-[0.82rem] leading-6 text-mist">{a.lead}</p>
              <p className="mt-3 text-[0.72rem] text-mist/80">
                <time dateTime={a.updated}>{jaDate(a.updated)}</time> 更新
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </BlogShell>
  );
}
