import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BlogShell, PrNotice } from "@/components/blog/BlogShell";
import { getArticle, jaDate, listArticles, renderBody, SITE } from "@/lib/blog";
import { OPERATOR } from "@/lib/operator";

export function generateStaticParams() {
  return listArticles().map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const a = getArticle((await params).slug);
  if (!a) return {};
  const url = `/blog/${a.slug}`;
  return {
    title: `${a.title} — yota`,
    description: a.description,
    alternates: { canonical: url },
    openGraph: { type: "article", url, title: a.title, description: a.description, siteName: "yota", locale: "ja_JP", publishedTime: a.published, modifiedTime: a.updated },
    twitter: { card: "summary", title: a.title, description: a.description },
  };
}

/** 読みものの記事ページ */
export default async function ArticlePage({ params }: PageProps<"/blog/[slug]">) {
  const a = getArticle((await params).slug);
  if (!a) notFound();
  const { html, toc } = renderBody(a.body);
  const related = (a.related ?? []).map(getArticle).filter((r) => r !== undefined);
  const cta = a.cta ?? { label: "yota で遊んでみる", href: `/?ref=blog-${a.slug}`, text: "登録なし・広告なし。年齢の確認と名前を決めるだけで始められます。" };
  const url = `${SITE}/blog/${a.slug}`;

  // 構造化データ：記事・パンくず・よくある質問
  const jsonLd: object[] = [
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: a.title,
      description: a.description,
      url,
      mainEntityOfPage: url,
      datePublished: a.published,
      dateModified: a.updated,
      inLanguage: "ja",
      author: { "@type": "Organization", name: `yota 運営（${OPERATOR.name}）`, url: SITE },
      publisher: { "@type": "Organization", name: "yota", url: SITE, logo: { "@type": "ImageObject", url: `${SITE}/icon-512.png` } },
      ...(a.sources?.length ? { citation: a.sources.map((s) => s.url) } : {}),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "yota", item: SITE },
        { "@type": "ListItem", position: 2, name: "読みもの", item: `${SITE}/blog` },
        { "@type": "ListItem", position: 3, name: a.title, item: url },
      ],
    },
  ];
  if (a.faq?.length) {
    jsonLd.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: a.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    });
  }

  return (
    <BlogShell back={{ href: cta.href, label: "遊んでみる" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <article>
        <h1 className="mt-6 break-phrase text-balance text-[1.5rem] font-black leading-snug">{a.title}</h1>
        <p className="mt-3 text-[0.75rem] text-mist">
          <time dateTime={a.published}>{jaDate(a.published)}</time> 公開
          {a.updated !== a.published && (
            <>
              ・<time dateTime={a.updated}>{jaDate(a.updated)}</time> 更新
            </>
          )}
          ・yota 運営
        </p>
        <PrNotice checked={a.checked && jaDate(a.checked)} />

        <div className="mt-6 rounded-3xl bg-brand/10 p-5">
          <p className="text-[0.75rem] font-black text-brand">この記事の答え</p>
          <p className="mt-2 text-[0.92rem] leading-7">{a.lead}</p>
        </div>

        {toc.length > 2 && (
          <nav aria-label="目次" className="mt-6 rounded-3xl border border-white/10 p-5">
            <p className="text-[0.8rem] font-black">目次</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-[0.85rem] leading-6 text-paper/85">
              {toc.map((t) => (
                <li key={t.id}>
                  <a href={`#${t.id}`} className="hover:text-brand">
                    {t.text}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        )}

        <div className="blog-body" dangerouslySetInnerHTML={{ __html: html }} />

        {a.faq?.length ? (
          <section className="blog-body">
            <h2>よくある質問</h2>
            {a.faq.map((f) => (
              <div key={f.q}>
                <h3>{f.q}</h3>
                <p>{f.a}</p>
              </div>
            ))}
          </section>
        ) : null}

        <aside className="mt-10 rounded-3xl bg-night-2 p-6 text-center">
          <p className="text-[0.95rem] font-black">AIのキャラと話して進める恋愛ストーリー「yota」</p>
          <p className="mt-2 text-[0.82rem] leading-6 text-mist">{cta.text}</p>
          <Link href={cta.href} className="press btn-brand mt-4 inline-block rounded-2xl px-8 py-3.5 text-[0.95rem]">
            {cta.label}
          </Link>
        </aside>

        {a.sources?.length ? (
          <section className="mt-10">
            <h2 className="text-[0.9rem] font-black">出典</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[0.78rem] leading-6 text-mist">
              {a.sources.map((s) => (
                <li key={s.url}>
                  <a href={s.url} target="_blank" rel="noopener" className="underline hover:text-paper">
                    {s.title}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </article>

      {related.length > 0 && (
        <section className="mt-12">
          <h2 className="text-[1rem] font-black">あわせて読みたい</h2>
          <ul className="mt-3 space-y-2">
            {related.map((r) => (
              <li key={r.slug}>
                <Link href={`/blog/${r.slug}`} className="press block rounded-2xl bg-night-2 px-4 py-3 text-[0.88rem] font-bold leading-6 hover:bg-night-3">
                  {r.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </BlogShell>
  );
}
