import { PlotList } from "@/components/PlotList";
import { PLOTS } from "@/lib/characters";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-xl px-4 pb-14">
      <header className="sticky top-0 z-10 -mx-4 mb-4 flex items-center justify-between bg-night/85 px-4 pb-3 pt-[max(0.9rem,env(safe-area-inset-top))] backdrop-blur-xl">
        <p className="text-brand-grad text-[1.6rem] font-black tracking-tight">yota</p>
        <span className="rounded-full bg-night-2 px-3 py-1.5 text-[0.7rem] font-bold text-mist">広告なし</span>
      </header>
      <h1 className="mb-4 text-[1.35rem] font-black leading-snug">今夜は、誰の物語を読む？</h1>
      <PlotList plots={PLOTS} />
      <footer className="mt-14 text-xs leading-6 text-mist/70">
        登場人物はすべて架空の18歳以上の人物です。返答はAIが生成しています。
      </footer>
    </main>
  );
}
