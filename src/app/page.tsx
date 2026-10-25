import { Featured } from "@/components/Featured";
import { PlotList } from "@/components/PlotList";
import { Shelf } from "@/components/Shelf";
import { UserName } from "@/components/UserName";
import { PLOTS } from "@/lib/characters";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-xl pb-14">
      <header className="sticky top-0 z-20 bg-night/80 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="flex h-14 items-center justify-between px-5">
          <p className="text-brand-grad text-[1.6rem] font-black leading-none tracking-tight">yota</p>
          <UserName />
        </div>
      </header>
      <div className="px-5 pt-3">
        <h1 className="text-[1.6rem] font-black leading-snug">今夜は、誰の物語を読む？</h1>
        <p className="mt-1.5 text-[0.85rem] text-mist">話しかければ、すぐに続きが返ってきます。</p>
      </div>
      <Featured plots={PLOTS.filter((p) => p.featured)} />
      <Shelf title="キャンパスの物語" hint="講義室、学園祭、寮の夜。大学が舞台の物語です" plots={PLOTS.filter((p) => p.tags.includes("大学"))} />
      <PlotList plots={PLOTS} />
      <footer className="mt-14 px-5 text-xs leading-6 text-mist/80">
        登場人物はすべて架空の18歳以上の人物です。返答はAIが生成しています。
      </footer>
    </main>
  );
}
