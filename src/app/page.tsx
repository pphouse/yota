import { Featured } from "@/components/Featured";
import { FeedbackSheet } from "@/components/FeedbackSheet";
import { ForYou } from "@/components/ForYou";
import { Logo } from "@/components/Logo";
import { PlotList } from "@/components/PlotList";
import { Shelf } from "@/components/Shelf";
import { UgcShelves } from "@/components/UgcShelves";
import { UserName } from "@/components/UserName";
import { PLOTS } from "@/lib/characters";
import Link from "next/link";
import { PenIcon } from "@/components/icons";

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
          </div>
        </div>
      </header>
      <Featured plots={PLOTS.filter((p) => p.featured)} />
      <ForYou />
      <UgcShelves />
      <Shelf title="学園もの" plots={PLOTS.filter((p) => p.tags.includes("大学"))} />
      <PlotList plots={PLOTS} />
      <footer className="mt-14 px-5 text-xs leading-6 text-mist/80">
        <p className="mb-3 text-[0.8rem]">
          yota はまだつくりはじめたばかりです。感想をいただけるとうれしいです。 <FeedbackSheet />
        </p>
        登場人物はすべて架空の18歳以上の人物です。返答はAIが生成しています。
      </footer>
    </main>
  );
}
