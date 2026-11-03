import Link from "next/link";
import { OPERATOR } from "@/lib/operator";

/** 読みもの（/blog）の共通の枠。上に yota へのリンク、下に運営者と規約 */
export function BlogShell({ children, back }: { children: React.ReactNode; back?: { href: string; label: string } }) {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pb-20">
      <header className="sticky top-0 z-20 -mx-5 bg-night/80 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="flex h-12 items-center justify-between gap-2 px-5">
          <nav aria-label="パンくず" className="flex min-w-0 items-center gap-2 text-[0.85rem] font-bold">
            <Link href="/" className="text-paper hover:text-brand">
              yota
            </Link>
            <span className="text-mist">/</span>
            <Link href="/blog" className="text-mist hover:text-paper">
              読みもの
            </Link>
          </nav>
          <Link href={back?.href ?? "/?ref=blog-header"} className="press btn-brand shrink-0 rounded-full px-4 py-1.5 text-[0.8rem]">
            {back?.label ?? "遊んでみる"}
          </Link>
        </div>
      </header>
      {children}
      <footer className="mt-16 border-t border-white/5 pt-6 text-xs leading-6 text-mist/80">
        <p>
          「読みもの」は、AIキャラと話す物語のアプリ yota の運営（{OPERATOR.name}）が書いています。ほかのサービスの情報は、各記事に書いた日付の時点で確かめた内容です。
        </p>
        <nav aria-label="yota について" className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[0.78rem] font-bold text-mist">
          <Link href="/" className="hover:text-paper">
            yota のトップ
          </Link>
          <Link href="/support" className="hover:text-paper">
            サポート
          </Link>
          <Link href="/terms" className="hover:text-paper">
            利用規約
          </Link>
          <Link href="/privacy" className="hover:text-paper">
            プライバシーポリシー
          </Link>
        </nav>
      </footer>
    </main>
  );
}

/** どの記事にも出す、書き手の明示（景品表示法のステルスマーケティング規制への対応） */
export function PrNotice({ checked }: { checked?: string }) {
  return (
    <p className="mt-4 rounded-2xl border border-white/10 bg-night-2 px-4 py-3 text-[0.78rem] leading-6 text-mist">
      <span className="mr-2 rounded bg-night-3 px-1.5 py-0.5 text-[0.7rem] font-bold text-paper">PR</span>
      この記事は、yota の運営が自社のアプリを紹介するために書いています。
      {checked &&
        ` ほかのサービスの情報は、記事の下の出典と、${checked} 時点で確かめた内容です。料金や条件は変わることがあるので、使う前に各サービスの表示で確かめてください。`}
    </p>
  );
}
