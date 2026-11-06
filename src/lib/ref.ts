/** 流入元（リンクの ?ref=）。英小文字・数字・ハイフン・下線の40文字まで。それ以外は記録しない */
export function normalizeRef(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const v = raw.trim().toLowerCase();
  return /^[a-z0-9_-]{1,40}$/.test(v) ? v : "";
}

const KEY = "yota_ref";
const SRC_KEY = "yota_src";

/**
 * 外から来たときの入口（Google 検索・ChatGPT・Claude など）を、ホスト名から決める。
 * 自分のサイト（yotachat.app やプレビュー）から来たときは "" を返す。
 */
const SOURCES: [RegExp, string][] = [
  [/(^|\.)chatgpt\.com$|(^|\.)chat\.openai\.com$|^openai\.com$/, "chatgpt"],
  [/(^|\.)claude\.ai$|(^|\.)claude\.com$/, "claude"],
  [/(^|\.)perplexity\.ai$/, "perplexity"],
  [/^gemini\.google\.com$|^bard\.google\.com$/, "gemini"],
  [/(^|\.)copilot\.microsoft\.com$/, "copilot"],
  [/(^|\.)grok\.com$/, "grok"],
  [/(^|\.)deepseek\.com$/, "deepseek"],
  [/(^|\.)google\.[a-z.]+$/, "google"],
  [/(^|\.)bing\.com$/, "bing"],
  [/(^|\.)yahoo\.co\.jp$|(^|\.)yahoo\.com$/, "yahoo"],
  [/(^|\.)duckduckgo\.com$/, "duckduckgo"],
  [/^t\.co$|(^|\.)x\.com$|(^|\.)twitter\.com$/, "x"],
  [/(^|\.)tiktok\.com$/, "tiktok"],
  [/(^|\.)instagram\.com$/, "instagram"],
  [/(^|\.)line\.me$/, "line"],
  [/(^|\.)youtube\.com$|^youtu\.be$/, "youtube"],
  [/(^|\.)pixiv\.net$/, "pixiv"],
  [/(^|\.)note\.com$/, "note"],
];

/** 入口の名前の一覧（管理画面で、記録を「入口」と「リンク」に分けるのに使う） */
export const SOURCE_NAMES = new Set(SOURCES.map(([, name]) => name));

/** セッションに付いた流入元（例 google__blog-zeta-hikkoshi）を、入口とリンクに分ける */
export function splitRef(raw: string): { src: string; link: string } {
  const v = normalizeRef(raw);
  if (!v) return { src: "", link: "" };
  const i = v.indexOf("__");
  if (i > 0) return { src: v.slice(0, i), link: v.slice(i + 2) };
  if (SOURCE_NAMES.has(v) || v.startsWith("web-")) return { src: v, link: "" };
  return { src: "", link: v };
}

export function sourceFromHost(host: string, selfHost = ""): string {
  const h = host.trim().toLowerCase().replace(/^www\./, "");
  if (!h || h === selfHost.replace(/^www\./, "") || h === "yotachat.app" || h.endsWith(".vercel.app") || h === "localhost") return "";
  for (const [re, name] of SOURCES) if (re.test(h)) return name;
  // そのほかのサイトは「web-ホスト名」として残す
  return normalizeRef(`web-${h.replace(/[^a-z0-9]+/g, "-")}`.slice(0, 40));
}

/** utm_source=chatgpt.com のような値を、sourceFromHost と同じ名前にそろえる */
export function sourceFromUtm(raw: string | null): string {
  if (!raw) return "";
  const v = raw.trim().toLowerCase();
  const asHost = sourceFromHost(v);
  if (asHost && !asHost.startsWith("web-")) return asHost;
  return normalizeRef(v.replace(/[^a-z0-9_-]+/g, "-").slice(0, 40));
}

/**
 * 外から来た入口（Google 検索・ChatGPT・Claude など）を、最初の1回だけこの端末に覚える。
 * utm_source を優先し、なければリファラーのホスト名から決める。新しく覚えたときだけ、その値を返す
 */
export function captureSource(search: string, referrer: string, selfHost: string): string | null {
  try {
    if (localStorage.getItem(SRC_KEY)) return null;
  } catch {
    return null;
  }
  let src = sourceFromUtm(new URLSearchParams(search).get("utm_source"));
  if (!src && referrer) {
    try {
      src = sourceFromHost(new URL(referrer).hostname, selfHost);
    } catch {
      src = "";
    }
  }
  if (!src) return null;
  try {
    localStorage.setItem(SRC_KEY, src);
  } catch {
    // 保存できない環境では記録しない
  }
  return src;
}

/**
 * 最初に開いたリンクの ?ref= を、この端末に覚えておく（あとで年齢確認をしたときにセッションに付ける）。
 * 新しく覚えたときだけ、その値を返す
 */
export function captureRef(search: string): string | null {
  const ref = normalizeRef(new URLSearchParams(search).get("ref"));
  if (!ref) return null;
  try {
    if (localStorage.getItem(KEY)) return null;
    localStorage.setItem(KEY, ref);
  } catch {
    // 保存できない環境（プライベートブラウズなど）では、このページを開いた記録だけ残す
  }
  return ref;
}

/**
 * 記録に付ける流入元。入口と ?ref= の両方があれば「入口__ref」（例：google__blog-zeta-hikkoshi）。
 * どちらか一方ならそれだけ。
 */
export function storedRef(): string {
  try {
    const ref = normalizeRef(localStorage.getItem(KEY));
    const src = normalizeRef(localStorage.getItem(SRC_KEY));
    if (src && ref && src !== ref) return normalizeRef(`${src}__${ref}`.slice(0, 40)) || ref;
    return ref || src;
  } catch {
    return "";
  }
}
