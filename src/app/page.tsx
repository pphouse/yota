import { Featured } from "@/components/Featured";
import { FeedbackSheet } from "@/components/FeedbackSheet";
import { ForYou } from "@/components/ForYou";
import { Logo } from "@/components/Logo";
import { PlotList } from "@/components/PlotList";
import { Shelf } from "@/components/Shelf";
import { UgcShelves } from "@/components/UgcShelves";
import { UserName } from "@/components/UserName";
import { PLOTS } from "@/lib/characters";
import { OPERATOR } from "@/lib/operator";
import { xConfig } from "@/lib/x";
import Link from "next/link";
import { MenuIcon, PenIcon } from "@/components/icons";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-xl pb-14">
      <header className="sticky top-0 z-20 bg-night/80 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="flex h-14 items-center justify-between px-5">
          <h1>
            <Logo className="h-[34px] w-auto text-paper" />
          </h1>
          <div className="flex items-center gap-2">
            <Link href="/create" className="press flex items-center gap-1 rounded-full bg-brand-grad px-3 py-1.5 text-[0.75rem] font-bold text-white">
              <PenIcon size={13} />
              つくる
            </Link>
            <UserName />
            <Link href="/settings" aria-label="設定" className="press grid size-9 place-items-center rounded-full text-mist hover:text-paper">
              <MenuIcon size={20} />
            </Link>
          </div>
        </div>
      </header>
      <Featured plots={PLOTS.filter((p) => p.featured)} />
      {/* X のキーが入っているときだけ、「Xから生まれる彼」の入口を出す */}
      {xConfig() && (
        <Link href="/x" className="press mx-5 mt-5 flex items-center gap-3 rounded-2xl bg-night-2 px-4 py-3.5">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-paper text-[1.1rem] font-black text-night">X</span>
          <span className="min-w-0 flex-1">
            <span className="block text-[0.95rem] font-black">Xから生まれる彼</span>
            <span className="block text-[0.75rem] leading-5 text-mist">あなたの投稿から、あなたに刺さる彼をAIがつくります</span>
          </span>
          <span className="text-[0.75rem] font-bold text-brand">診断する ›</span>
        </Link>
      )}
      <ForYou />
      <UgcShelves />
      <Shelf title="学園もの" plots={PLOTS.filter((p) => p.tags.includes("大学"))} />
      <PlotList plots={PLOTS} />
      <footer className="mt-16 border-t border-white/5 px-5 pt-6 text-xs leading-6 text-mist/80">
        <nav aria-label="yota について" className="flex flex-wrap gap-x-5 gap-y-2 text-[0.78rem] font-bold text-mist">
          <Link href="/blog" className="hover:text-paper">
            読みもの
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
          <FeedbackSheet label="ご意見・お問い合わせ" triggerClassName="font-bold hover:text-paper" />
        </nav>
        <p className="mt-4">登場人物はすべて架空の18歳以上の人物です。返答はAIが生成しています。</p>
        <p className="mt-1">© 2026 {OPERATOR.name}</p>
      </footer>
    </main>
  );
}
