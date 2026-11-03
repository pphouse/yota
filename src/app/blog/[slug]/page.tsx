import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Author, BlogShell, Share } from "@/components/blog/BlogShell";
import { dotDate, getArticle, jaDate, listArticles, readingMinutes, renderBody, SITE } from "@/lib/blog";
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
    openGraph: {
      type: "article",
      url,
      title: a.title,
      description: a.description,
      siteName: "yota",
      locale: "ja_JP",
      publishedTime: a.published,
      modifiedTime: a.updated,
      images: [{ url: a.eyecatch }],
    },
    twitter: { card: "summary_large_image", title: a.title, description: a.description },
  };
}

/** 読みものの記事ページ */
export default async function ArticlePage({ params }: PageProps<"/blog/[slug]">) {
  const a = getArticle((await params).slug);
  if (!a) notFound();
  const cta = a.cta ?? { label: "yota で遊んでみる", href: `/?ref=blog-${a.slug}`, text: "登録なし・広告なし。年齢の確認と名前を決めるだけで始められます。" };
  const { html, toc } = renderBody(a.body, cta.href);
  const related = (a.related ?? []).map(getArticle).filter((r) => r !== undefined);
  const url = `${SITE}/blog/${a.slug}`;

  // 構造化データ：記事・パンくず・よくある質問
  const jsonLd: object[] = [
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: a.title,
      description: a.description,
      image: `${SITE}${a.eyecatch}`,
      url,
      mainEntityOfPage: url,
      datePublished: a.published,
      dateModified: a.updated,
      inLanguage: "ja",
      author: { "@type": "Organization", name: `yota 編集部（${OPERATOR.name}）`, url: `${SITE}/blog` },
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
    <BlogShell cta={cta.href}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <article className="mx-auto max-w-3xl px-4">
        {/* パンくず */}
        <nav aria-label="パンくず" className="pt-4 text-[0.72rem] text-ink-3">
          <Link href="/" className="hover:text-brand">
            yota
          </Link>
          <span className="mx-1.5">›</span>
          <Link href="/blog" className="hover:text-brand">
            読みもの
          </Link>
          <span className="mx-1.5">›</span>
          <span>{a.category}</span>
        </nav>

        {/* 題名と日付 */}
        <header className="mt-4">
          <p className="flex flex-wrap items-center gap-2 text-[0.72rem]">
            <span className="rounded-full bg-brand/10 px-2.5 py-0.5 font-bold text-[#8a2fc0]">{a.category}</span>
            <span className="text-ink-3">
              <time dateTime={a.published}>{dotDate(a.published)}</time> 公開
              {a.updated !== a.published && (
                <>
                  {" ・ "}
                  <time dateTime={a.updated}>{dotDate(a.updated)}</time> 更新
                </>
              )}
            </span>
            <span className="text-ink-3">・約{readingMinutes(a)}分で読めます</span>
          </p>
          <h1 className="mt-3 break-phrase text-balance text-[1.55rem] font-black leading-[1.5] text-ink sm:text-[1.9rem]">{a.title}</h1>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <Author />
            {a.checked && (
              <span className="rounded-md bg-white px-2 py-1 text-[0.7rem] font-bold text-ink-2 ring-1 ring-black/5">
                情報の確認日：{jaDate(a.checked)}
              </span>
            )}
          </div>
          <p className="mt-3 text-[0.7rem] leading-5 text-ink-3">
            ※ 本ページはプロモーションを含みます。yota の運営が、自社のアプリを紹介するために書いています。
          </p>
        </header>

        {/* 大きな絵 */}
        <div className="relative mt-5 aspect-[16/9] overflow-hidden rounded-2xl bg-[#ece6f2]">
          <Image src={a.eyecatch} alt="" fill sizes="(min-width: 768px) 736px, 100vw" preload className="object-cover object-[50%_30%]" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
          <p className="absolute bottom-3 left-4 right-4 text-[0.75rem] font-bold text-white/90">yota の物語より</p>
        </div>

        {/* この記事でわかること */}
        <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
          <p className="text-[0.85rem] font-black text-[#d6336c]">この記事でわかること</p>
          <ol className="mt-3 space-y-2.5">
            {a.points.map((p, i) => (
              <li key={p} className="flex gap-3 text-[0.95rem] font-bold leading-7 text-ink">
                <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-[image:var(--brand-grad)] text-[0.75rem] text-white">{i + 1}</span>
                <span>{p}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* 目次 */}
        {toc.length > 2 && (
          <nav aria-label="目次" className="mt-6 rounded-2xl border border-black/5 bg-white p-5">
            <p className="text-[0.95rem] font-black text-ink">目次</p>
            <ol className="mt-3 space-y-2 text-[0.88rem] leading-6">
              {toc.map((t, i) => (
                <li key={t.id}>
                  <a href={`#${t.id}`} className="flex gap-2 font-bold text-ink-2 hover:text-brand">
                    <span className="text-brand">{i + 1}.</span>
                    {t.text}
                  </a>
                  {t.sub.length > 0 && (
                    <ol className="mt-1.5 space-y-1 pl-6">
                      {t.sub.map((s, j) => (
                        <li key={s.id}>
                          <a href={`#${s.id}`} className="text-[0.82rem] text-ink-3 hover:text-brand">
                            {i + 1}-{j + 1}. {s.text}
                          </a>
                        </li>
                      ))}
                    </ol>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        )}

        <div className="blog-body mt-4" dangerouslySetInnerHTML={{ __html: html }} />

        {/* まとめ */}
        <div className="blog-body mt-16">
          <h2 id="summary">
            <span className="h2-num">{String(toc.length + 1).padStart(2, "0")}</span>まとめ
          </h2>
          <ul>
            {a.summary.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>

        {/* よくある質問 */}
        {a.faq?.length ? (
          <section className="mt-14">
            <h2 className="text-[1.2rem] font-black text-ink">よくある質問</h2>
            <div className="mt-4 space-y-3">
              {a.faq.map((f) => (
                <div key={f.q} className="rounded-2xl bg-white p-5 ring-1 ring-black/5">
                  <h3 className="flex gap-2.5 text-[0.98rem] font-black leading-7 text-ink">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand text-[0.8rem] text-white">Q</span>
                    {f.q}
                  </h3>
                  <p className="mt-2 flex gap-2.5 text-[0.92rem] leading-7 text-ink-2">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#ffe3f0] text-[0.8rem] font-black text-[#d6336c]">A</span>
                    {f.a}
                  </p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* ボタン */}
        <aside className="mt-12 overflow-hidden rounded-3xl bg-[#1b1a22] p-6 text-center text-white">
          <p className="text-[0.75rem] font-bold text-white/60">AIのキャラと話して進める恋愛ストーリー</p>
          <p className="mt-1 text-[1.3rem] font-black">yota（ヨタ）</p>
          <p className="mt-2 text-[0.85rem] leading-6 text-white/80">{cta.text}</p>
          <Link href={cta.href} className="mt-5 block rounded-full bg-[image:var(--brand-grad)] py-3.5 text-[1rem] font-black shadow-lg shadow-fuchsia-500/20">
            {cta.label}
          </Link>
        </aside>

        <div className="mt-8">
          <p className="mb-2 text-[0.75rem] font-bold text-ink-3">この記事を共有する</p>
          <Share url={url} title={a.title} />
        </div>

        <Author box />

        {/* 出典 */}
        {a.sources?.length ? (
          <section className="mt-8 rounded-2xl bg-white/60 p-5 ring-1 ring-black/5">
            <h2 className="text-[0.85rem] font-black text-ink">参考にした情報（{a.checked && jaDate(a.checked)}に確認）</h2>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[0.78rem] leading-6 text-ink-2">
              {a.sources.map((s) => (
                <li key={s.url}>
                  <a href={s.url} target="_blank" rel="noopener" className="underline hover:text-brand">
                    {s.title}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* 関連記事 */}
        {related.length > 0 && (
          <section className="mt-12">
            <h2 className="text-[1.1rem] font-black text-ink">あわせて読みたい</h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {related.map((r) => (
                <li key={r.slug}>
                  <Link href={`/blog/${r.slug}`} className="group flex gap-3 rounded-2xl bg-white p-3 ring-1 ring-black/5 hover:ring-brand/40">
                    <div className="relative aspect-square w-20 shrink-0 overflow-hidden rounded-xl">
                      <Image src={r.eyecatch} alt="" fill sizes="80px" className="object-cover object-[50%_25%]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[0.68rem] font-bold text-[#8a2fc0]">{r.category}</p>
                      <p className="mt-0.5 line-clamp-3 text-[0.85rem] font-bold leading-6 text-ink group-hover:text-brand">{r.title}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </article>
    </BlogShell>
  );
}
