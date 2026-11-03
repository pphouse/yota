import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BlogShell } from "@/components/blog/BlogShell";
import { dotDate, listArticles, readingMinutes, SITE } from "@/lib/blog";

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
  const [first, ...rest] = articles;
  return (
    <BlogShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="mx-auto max-w-3xl px-4">
        <section className="pt-8">
          <h1 className="text-[1.6rem] font-black text-ink">読みもの</h1>
          <p className="mt-2 text-[0.9rem] leading-7 text-ink-2">
            AIキャラチャットの使い方や選び方、AIで物語を楽しむコツを、yota 編集部がまとめています。
          </p>
        </section>

        {first && (
          <Link href={`/blog/${first.slug}`} className="group mt-6 block overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-black/5">
            <div className="relative aspect-[16/9]">
              <Image src={first.eyecatch} alt="" fill sizes="(min-width: 768px) 736px, 100vw" preload className="object-cover object-[50%_30%]" />
            </div>
            <div className="p-5">
              <p className="text-[0.72rem] font-bold text-[#8a2fc0]">{first.category}</p>
              <h2 className="mt-1 text-[1.2rem] font-black leading-snug text-ink group-hover:text-brand">{first.title}</h2>
              <p className="mt-2 line-clamp-2 text-[0.85rem] leading-6 text-ink-2">{first.lead}</p>
              <p className="mt-3 text-[0.72rem] text-ink-3">
                {dotDate(first.updated)}・約{readingMinutes(first)}分
              </p>
            </div>
          </Link>
        )}

        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {rest.map((a) => (
            <li key={a.slug}>
              <Link href={`/blog/${a.slug}`} className="group block h-full overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
                <div className="relative aspect-[16/9]">
                  <Image src={a.eyecatch} alt="" fill sizes="(min-width: 640px) 360px, 100vw" className="object-cover object-[50%_30%]" />
                </div>
                <div className="p-4">
                  <p className="text-[0.7rem] font-bold text-[#8a2fc0]">{a.category}</p>
                  <h2 className="mt-1 text-[0.98rem] font-black leading-snug text-ink group-hover:text-brand">{a.title}</h2>
                  <p className="mt-2 text-[0.7rem] text-ink-3">
                    {dotDate(a.updated)}・約{readingMinutes(a)}分
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </BlogShell>
  );
}
