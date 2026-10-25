import { PlotList } from "@/components/PlotList";
import { PLOTS } from "@/lib/characters";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-xl px-5 pb-16 pt-[max(2.5rem,env(safe-area-inset-top))]">
      <header className="mb-10">
        <p className="text-sm text-mist">yota</p>
        <h1 className="mt-3 font-mincho text-[2rem] leading-[1.35] tracking-wide">
          推しとの物語を、
          <br />
          今夜もう一頁。
        </h1>
        <p className="mt-4 max-w-sm text-[0.95rem] leading-7 text-mist">
          話しかけると、すぐに返事が届きます。物語の中に入ることも、ふたりを見守ることもできます。
        </p>
      </header>
      <PlotList plots={PLOTS} />
      <footer className="mt-16 text-xs leading-6 text-mist">
        登場人物はすべて架空の18歳以上の人物です。返答はAIが生成しています。
      </footer>
    </main>
  );
}
