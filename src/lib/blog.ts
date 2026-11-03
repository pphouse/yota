import { marked } from "marked";
import { ARTICLES } from "@/content/blog";

/**
 * 読みもの（/blog）の記事。本文は Markdown で src/content/blog/<slug>.ts に書き、index.ts に足す。
 *
 * 書くときの決まり（SEO より先に守る）
 * - yota の運営が書いていることを、どの記事にもはっきり出す（ステマ規制。ページの上に自動で出る）。
 * - ほかのアプリについては、確かめた事実だけを書き、出典（sources）と確かめた日（checked）を必ず入れる。悪口や推測は書かない。
 * - yota の弱いところも書く。比べる記事では、yota 以外の選び方も公平に書く。
 * - 似た記事を量産しない。1本ごとに、検索した人が知りたいことに答えきる。
 */
export type Article = {
  slug: string;
  /** 検索結果に出る題名（32字前後まで） */
  title: string;
  /** 検索結果の説明文（120字前後まで） */
  description: string;
  /** 記事の上に出す短い要約（答えを先に） */
  lead: string;
  /** 公開日・更新日（YYYY-MM-DD） */
  published: string;
  updated: string;
  /** ほかのアプリの情報を確かめた日（YYYY-MM-DD）。ほかのアプリに触れない記事は省く */
  checked?: string;
  /** 狙う検索の言葉（記事を書くときの目安。ページには出さない） */
  keywords: string[];
  /** 本文（Markdown）。h2 から始める */
  body: string;
  /** よくある質問。ページの下に出し、構造化データ（FAQPage）にもする */
  faq?: { q: string; a: string }[];
  /** 出典 */
  sources?: { title: string; url: string }[];
  /** 記事の終わりのボタン。既定はホーム */
  cta?: { label: string; href: string; text: string };
  /** 関連記事の slug */
  related?: string[];
};

export const SITE = "https://yotachat.app";

export function listArticles(): Article[] {
  return [...ARTICLES].sort((a, b) => b.updated.localeCompare(a.updated) || a.slug.localeCompare(b.slug));
}

export function getArticle(slug: string): Article | undefined {
  return ARTICLES.find((a) => a.slug === slug);
}

/** 本文の Markdown を HTML にする。外へのリンクは新しいタブで開き、検索エンジンに評価を渡しすぎないよう noopener を付ける */
export function renderBody(md: string): { html: string; toc: { id: string; text: string }[] } {
  const toc: { id: string; text: string }[] = [];
  const renderer = new marked.Renderer();
  renderer.heading = function ({ tokens, depth }) {
    const text = this.parser.parseInline(tokens);
    if (depth === 2) {
      const id = `s${toc.length + 1}`;
      toc.push({ id, text: text.replace(/<[^>]+>/g, "") });
      return `<h2 id="${id}">${text}</h2>`;
    }
    return `<h${depth}>${text}</h${depth}>`;
  };
  renderer.link = function ({ href, tokens }) {
    const text = this.parser.parseInline(tokens);
    const external = /^https?:\/\//.test(href) && !href.startsWith(SITE);
    return external ? `<a href="${href}" target="_blank" rel="noopener">${text}</a>` : `<a href="${href}">${text}</a>`;
  };
  renderer.table = function (token) {
    // 表は横にはみ出すことがあるので、横にだけスクロールできる箱に入れる
    return `<div class="table-wrap">${marked.Renderer.prototype.table.call(this, token)}</div>`;
  };
  const html = marked.parse(md, { renderer, async: false }) as string;
  return { html, toc };
}

/** 日付を「2026年11月3日」の形にする */
export function jaDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return `${y}年${m}月${d}日`;
}
