import { PlotList } from "@/components/PlotList";
import { PLOTS } from "@/lib/characters";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-xl px-5 pb-14 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <header className="mb-7">
        <p className="font-mincho text-lg font-bold tracking-[0.12em]">yota</p>
        <h1 className="mt-6 font-mincho text-[1.75rem] font-bold leading-[1.4]">今夜は、誰の物語を読む？</h1>
        <p className="mt-2.5 text-[0.9rem] leading-7 text-mist">話しかければ、すぐに続きが返ってきます。</p>
      </header>
      <PlotList plots={PLOTS} />
      <footer className="mt-14 text-xs leading-6 text-mist/80">
        登場人物はすべて架空の18歳以上の人物です。返答はAIが生成しています。
      </footer>
    </main>
  );
}
