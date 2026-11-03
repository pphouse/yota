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
 *
 * 読みやすさの決まり
 * - 1段落は1〜3文。長くなったら切る。
 * - 結論を先に（points の3行）。最後に summary でまとめる。
 * - 本文で使える飾り：
 *   - `:::point 見出し` 〜 `:::` … 要点の囲み（`note`＝補足、`warn`＝注意 も使える）
 *   - `[[yota]]` だけの行 … yota の紹介カード
 */
export type Article = {
  slug: string;
  /** 検索結果に出る題名（32字前後まで） */
  title: string;
  /** 検索結果の説明文（120字前後まで） */
  description: string;
  /** カテゴリ（一覧と記事の上に出す） */
  category: string;
  /** 冒頭の「この記事でわかること」。3つ */
  points: string[];
  /** 記事の上に出す大きな絵（public の画像のパス） */
  eyecatch: string;
  /** 一覧に出す短い要約 */
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
  /** 最後の「まとめ」の箇条書き */
  summary: string[];
  /** よくある質問。ページの下に出し、構造化データ（FAQPage）にもする */
  faq?: { q: string; a: string }[];
  /** 出典 */
  sources?: { title: string; url: string }[];
  /** 記事のボタン。既定はホーム */
  cta?: { label: string; href: string; text: string };
  /** 関連記事の slug */
  related?: string[];
};

export const SITE = "https://yotachat.app";

export function listArticles(): Article[] {
  return [...ARTICLES].sort((a, b) => b.updated.localeCompare(a.updated));
}

export function getArticle(slug: string): Article | undefined {
  return ARTICLES.find((a) => a.slug === slug);
}

/** 読むのにかかる時間（分）。日本語はおよそ1分500字 */
export function readingMinutes(a: Article): number {
  const chars = (a.body + a.summary.join("") + (a.faq ?? []).map((f) => f.q + f.a).join("")).replace(/\s|[#*|`>:-]/g, "").length;
  return Math.max(1, Math.round(chars / 500));
}

const BOX_LABEL = { point: "ポイント", note: "補足", warn: "注意" } as const;

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** 記事の途中に入れる yota の紹介カード */
export function yotaCardHtml(href: string): string {
  return `<div class="app-card">
  <img src="/icon-192.png" alt="" width="56" height="56" class="app-card-icon" />
  <div class="app-card-main">
    <p class="app-card-name">yota（ヨタ）</p>
    <p class="app-card-desc">AIのキャラと話して進める恋愛ストーリー</p>
    <ul class="app-card-tags"><li>無料</li><li>広告なし</li><li>登録なしで開始</li><li>13歳以上</li></ul>
  </div>
  <a href="${escapeHtml(href)}" class="app-card-btn cta-btn">無料で遊ぶ<span class="cta-arrow" aria-hidden="true">→</span></a>
</div>`;
}

/**
 * 本文の Markdown を HTML にする。
 * 外へのリンクは新しいタブで開く。h2・h3 には目次用の id を付ける。
 */
export function renderBody(md: string, ctaHref: string): { html: string; toc: { id: string; text: string; sub: { id: string; text: string }[] }[] } {
  const toc: { id: string; text: string; sub: { id: string; text: string }[] }[] = [];
  const renderer = new marked.Renderer();
  renderer.heading = function ({ tokens, depth }) {
    const text = this.parser.parseInline(tokens);
    const plain = text.replace(/<[^>]+>/g, "");
    if (depth === 2) {
      const id = `s${toc.length + 1}`;
      toc.push({ id, text: plain, sub: [] });
      return `<h2 id="${id}"><span class="h2-num">${String(toc.length).padStart(2, "0")}</span>${text}</h2>`;
    }
    if (depth === 3 && toc.length) {
      const parent = toc[toc.length - 1];
      const id = `${parent.id}-${parent.sub.length + 1}`;
      parent.sub.push({ id, text: plain });
      return `<h3 id="${id}">${text}</h3>`;
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
  const parse = (s: string) => marked.parse(s, { renderer, async: false }) as string;

  // 囲み枠（:::point 見出し 〜 :::）と yota のカード（[[yota]]）を切り出してから、残りを Markdown として読む
  const parts: string[] = [];
  const re = /^:::(point|note|warn)[ \t]*(.*)\n([\s\S]*?)\n:::[ \t]*$|^\[\[yota\]\][ \t]*$/gm;
  let last = 0;
  for (const m of md.matchAll(re)) {
    parts.push(parse(md.slice(last, m.index)));
    if (m[0].startsWith("[[")) {
      parts.push(yotaCardHtml(ctaHref));
    } else {
      const kind = m[1] as keyof typeof BOX_LABEL;
      const title = m[2]?.trim() || BOX_LABEL[kind];
      parts.push(`<div class="box box-${kind}"><p class="box-title">${escapeHtml(title)}</p>${parse(m[3])}</div>`);
    }
    last = m.index + m[0].length;
  }
  parts.push(parse(md.slice(last)));
  return { html: parts.join(""), toc };
}

/** 日付を「2026年11月3日」の形にする */
export function jaDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return `${y}年${m}月${d}日`;
}

/** 日付を「2026.11.03」の形にする */
export function dotDate(ymd: string): string {
  return ymd.replace(/-/g, ".");
}
