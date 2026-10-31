import { Featured } from "@/components/Featured";
import { ForYou } from "@/components/ForYou";
import { Logo } from "@/components/Logo";
import { PlotList } from "@/components/PlotList";
import { Shelf } from "@/components/Shelf";
import { UserName } from "@/components/UserName";
import { PLOTS } from "@/lib/characters";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-xl pb-14">
      <header className="sticky top-0 z-20 bg-night/80 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="flex h-14 items-center justify-between px-5">
          <h1>
            <Logo className="h-[34px] w-auto text-paper" />
          </h1>
          <UserName />
        </div>
      </header>
      <Featured plots={PLOTS.filter((p) => p.featured)} />
      <ForYou />
      <Shelf title="学園もの" plots={PLOTS.filter((p) => p.tags.includes("大学"))} />
      <PlotList plots={PLOTS} />
      <footer className="mt-14 px-5 text-xs leading-6 text-mist/80">
        登場人物はすべて架空の18歳以上の人物です。返答はAIが生成しています。
      </footer>
    </main>
  );
}
