import Image from "next/image";
import Link from "next/link";
import { OPERATOR } from "@/lib/operator";

/**
 * 読みもの（/blog）の共通の枠。アプリの画面と違い、長い文章を読みやすいよう白い背景にする。
 * 上にロゴとナビ、下に運営者と規約。
 */
export function BlogShell({ children, cta }: { children: React.ReactNode; cta?: string }) {
  return (
    <div className="blog-page flex-1">
      <header className="sticky top-0 z-20 border-b border-black/5 bg-white/90 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-3 px-4">
          <Link href="/blog" className="flex items-center gap-2">
            <Image src="/icon-192.png" alt="" width={28} height={28} className="rounded-lg" />
            <span className="text-[1rem] font-black tracking-tight text-ink">
              yota <span className="text-[0.8rem] font-bold text-ink-3">読みもの</span>
            </span>
          </Link>
          <nav className="flex items-center gap-4 text-[0.8rem] font-bold text-ink-2">
            <Link href="/" className="hidden hover:text-brand sm:inline">
              アプリTOP
            </Link>
            <Link href="/blog" className="hidden hover:text-brand sm:inline">
              記事一覧
            </Link>
            <Link href={cta ?? "/?ref=blog-header"} className="rounded-full bg-[image:var(--brand-grad)] px-4 py-2 text-white shadow-sm">
              無料で遊ぶ
            </Link>
          </nav>
        </div>
      </header>
      {children}
      <footer className="mt-20 border-t border-black/5 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-10 text-[0.8rem] leading-7 text-ink-3">
          <div className="flex items-center gap-2">
            <Image src="/icon-192.png" alt="" width={24} height={24} className="rounded-md" />
            <span className="font-black text-ink">yota 読みもの</span>
          </div>
          <p className="mt-3">
            AIキャラと話す物語のアプリ「yota」の運営（{OPERATOR.name}）が書いています。ほかのサービスの情報は、各記事に書いた日付の時点で確かめた内容です。
          </p>
          <nav aria-label="yota について" className="mt-5 flex flex-wrap gap-x-6 gap-y-2 font-bold text-ink-2">
            <Link href="/" className="hover:text-brand">
              アプリTOP
            </Link>
            <Link href="/blog" className="hover:text-brand">
              記事一覧
            </Link>
            <Link href="/support" className="hover:text-brand">
              お問い合わせ
            </Link>
            <Link href="/terms" className="hover:text-brand">
              利用規約
            </Link>
            <Link href="/privacy" className="hover:text-brand">
              プライバシーポリシー
            </Link>
          </nav>
          <p className="mt-6 text-[0.72rem]">© 2026 {OPERATOR.name}</p>
        </div>
      </footer>
    </div>
  );
}

/** 書いた人（記事の上は小さく、下は箱で） */
export function Author({ box = false }: { box?: boolean }) {
  if (!box) {
    return (
      <div className="flex items-center gap-2.5">
        <Image src="/icon-192.png" alt="" width={36} height={36} className="rounded-full ring-1 ring-black/5" />
        <div className="leading-tight">
          <p className="text-[0.82rem] font-bold text-ink">yota 編集部</p>
          <p className="text-[0.7rem] text-ink-3">yota の運営チーム</p>
        </div>
      </div>
    );
  }
  return (
    <section className="mt-12 rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
      <p className="text-[0.75rem] font-bold text-ink-3">この記事を書いた人</p>
      <div className="mt-3 flex items-start gap-3">
        <Image src="/icon-192.png" alt="" width={56} height={56} className="shrink-0 rounded-full ring-1 ring-black/5" />
        <div>
          <p className="font-black text-ink">yota 編集部</p>
          <p className="mt-1 text-[0.82rem] leading-6 text-ink-2">
            AIのキャラと話して進める恋愛ストーリーのアプリ「yota」を作っている運営チームです。ほかのアプリについては、自分たちで確かめた事実と出典だけを書き、yota の足りないところも正直に書くようにしています。
          </p>
        </div>
      </div>
    </section>
  );
}

/** X・LINE で共有するボタン（外部のスクリプトは読まない、ただのリンク） */
export function Share({ url, title }: { url: string; title: string }) {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);
  const btn = "flex-1 rounded-full py-2 text-center text-[0.78rem] font-bold text-white";
  return (
    <div className="flex gap-2">
      <a href={`https://x.com/intent/post?text=${t}&url=${u}`} target="_blank" rel="noopener" className={`${btn} bg-black`}>
        X でポスト
      </a>
      <a href={`https://social-plugins.line.me/lineit/share?url=${u}`} target="_blank" rel="noopener" className={`${btn} bg-[#06c755]`}>
        LINE で送る
      </a>
    </div>
  );
}
