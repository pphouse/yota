import "@fontsource/shippori-mincho/800.css";
import "@fontsource/zen-kaku-gothic-new/400.css";
import "@fontsource/zen-kaku-gothic-new/500.css";
import "@fontsource/zen-kaku-gothic-new/700.css";
import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { CREATOR_UPDATES } from "@/lib/creator-updates";
import { OPERATOR } from "@/lib/operator";

export const metadata: Metadata = {
  title: "作者さん募集 — yota",
  description:
    "yota は、会話で進む恋愛ストーリーのアプリ。オリジナルのキャラと物語を作ってくれる作者さんを募集しています。一行のアイデアから下書き、ほかのアプリからの引っ越しもかんたん。登録なし・無料。",
  alternates: { canonical: "/creators" },
};

const CREATE = "/create?ref=lp-creator";
const IMPORT = "/create?import=1&ref=lp-creator";

const sans = "font-['Zen_Kaku_Gothic_New',var(--font-sans)]";
const mincho = "font-['Shippori_Mincho',serif] font-extrabold";
const accent = "text-[#f2a3bb]";
const muted = "text-[#c9c0bb]";
const eyebrow = `m-0 text-[15px] font-bold tracking-[0.2em] ${accent}`;
const h2 = `m-0 ${mincho} text-[clamp(1.8rem,4vw,2.6rem)] leading-[1.4]`;
const primary =
  "press inline-flex min-h-[52px] items-center rounded-full bg-[#f2a3bb] px-7 text-base font-bold text-[#1a1014] no-underline hover:bg-[#f7b9cb]";
const secondary =
  "press inline-flex min-h-[52px] items-center rounded-full border border-[#5a4a52] px-7 text-base font-medium text-[#efe9e4] no-underline hover:border-[#8a7480]";

const PROMISES = [
  { n: "01", title: "声は、運営が全部読む", body: "要望も不満も、運営が自分で読んで、自分で返事をします。自動の返信や、読まれないままの窓口にはしません。" },
  {
    n: "02",
    title: "早ければ、翌日に変わる",
    body: "yota はアプリもWebを読み込む作り。直した内容は、ストアの審査を待たずにすぐ届きます。小さな直しなら、早ければ翌日に。",
  },
  {
    n: "03",
    title: "変わったことは、毎週お知らせ",
    body: "「今週、作者さんの声で変わったこと」を毎週まとめます。あなたの一言がどう形になったか、ちゃんと見えるように。",
  },
];

const STEPS = [
  { title: "設定を貼る", body: "キャラ設定・プロンプト・イントロ・状況例・トークプロフィールなど、手元にあるものをそのまま。" },
  { title: "AIが yota の形に移す", body: "足りない項目だけを補い、変えたこと・省いたことは移したあとにお知らせします。" },
  { title: "確かめて、保存する", body: "保存する前に、下書きを自分の目で確かめられます。試しに会話してからでも。" },
];

const TOOLS = [
  { title: "アイデアから下書き", body: "一行書けば、題名・キャラ・最初の一言までAIが下書き。白紙から書くこともできます。" },
  { title: "必須は7つだけ", body: "題名・舞台・名前・年齢・口調・性格か見た目・最初の一言。ほかは空のままでも作品になります。" },
  { title: "どの欄にも「AIで考える」", body: "いま書いてある内容に合わせて、案をいくつか出します。選んで入れるだけ。" },
  { title: "書きかけのまま、試しに話す", body: "保存しなくても、名前と口調と最初の一言があれば、すぐに会話を試せます。" },
  { title: "演出はアプリにおまかせ", body: "ぼかした「心の声」、言いかけて消す言葉、山場のカットイン。あなたのキャラにも自動でつきます。" },
  { title: "表紙も自動で", body: "保存すると、タイトル入りのジャケットができます。キャラの画像も登録できます。" },
];

const FAQ = [
  { q: "お金はかかりますか？", a: "かかりません。年齢の確認と、物語の中で呼ばれる名前を決めるだけで、登録なしで作り始められます。" },
  { q: "ほかのアプリで公開中の作品も持ってこられますか？", a: "ご自身で作ったオリジナルの作品なら大丈夫です。既存の作品や実在の人物をもとにしたものは、移せません。" },
  {
    q: "作ったらすぐ、みんなに見てもらえますか？",
    a: "作った作品は、すぐにリンクで友だちに遊んでもらえます。一覧の「みんなの作品」に載せるときは、運営が中身を確かめてからになります。",
  },
  { q: "どんなキャラでも作れますか？", a: "登場人物は、全員18歳以上の架空の人物にしてください。性的な描写は書かない作りになっています。" },
];

function Buttons({ center = false }: { center?: boolean }) {
  return (
    <div className={`flex flex-wrap gap-3.5 ${center ? "justify-center" : ""}`}>
      <Link href={CREATE} className={primary}>
        作品を作ってみる
      </Link>
      <Link href={IMPORT} className={secondary}>
        ほかのアプリから引っ越す
      </Link>
    </div>
  );
}

/** 作者募集のページ（LP）。オリジナルの作品を作ってくれる作者さんと、ほかのアプリからの引っ越しを呼びかける */
export default function CreatorsPage() {
  return (
    <div className={`bg-[#0f0f13] text-base leading-[1.8] text-[#efe9e4] ${sans} [&_a:not([class])]:text-[#f2a3bb] [&_a:not([class]):hover]:text-[#ffd0dd]`}>
      <header className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-4 px-5 pb-6 pt-[max(1.5rem,env(safe-area-inset-top))]">
        <Link href="/" aria-label="yota のトップへ" className="press text-[#efe9e4]">
          <Logo className="h-9 w-auto" />
        </Link>
        <Link
          href={CREATE}
          className="press inline-flex min-h-11 items-center rounded-full border border-[#5a4a52] px-5 text-[15px] font-medium text-[#efe9e4] no-underline hover:border-[#8a7480]"
        >
          作品を作る
        </Link>
      </header>

      <main>
        <section className="mx-auto flex max-w-[1120px] flex-col gap-7 px-5 pb-24 pt-[72px]">
          <p className={eyebrow}>作者さん募集</p>
          <h1 className={`m-0 ${mincho} text-[clamp(2.6rem,7vw,5.2rem)] leading-[1.25] tracking-[0.02em]`}>
            作る人と、
            <br />
            一緒に育てる。
          </h1>
          <p className={`m-0 max-w-[40rem] text-[1.15rem] ${muted}`}>
            yota は、会話で進む恋愛ストーリーのアプリです。まだ小さくて、足りないところだらけ。だからこそ、あなたの「こうしたい」で、来週の yota が変わります。
          </p>
          <div className="pt-2">
            <Buttons />
          </div>
          <p className="m-0 text-sm text-[#a39a96]">登録なし・無料。18歳以上なら、どなたでも作れます。</p>
        </section>

        <section className="bg-[#17151b] px-5 py-[88px]">
          <div className="mx-auto flex max-w-[1120px] flex-col gap-10">
            <h2 className={h2}>yota が、作者さんに約束すること</h2>
            <div className="flex flex-wrap gap-5">
              {PROMISES.map((p) => (
                <div key={p.n} className="flex flex-[1_1_300px] flex-col gap-2.5 rounded-2xl bg-[#1f1c24] p-7">
                  <p className={`m-0 ${mincho} text-[40px] leading-none ${accent}`}>{p.n}</p>
                  <h3 className="m-0 text-xl font-bold">{p.title}</h3>
                  <p className={`m-0 ${muted}`}>{p.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto flex max-w-[1120px] flex-col gap-10 px-5 py-24">
          <div className="flex max-w-[44rem] flex-col gap-3.5">
            <p className={eyebrow}>引っ越し</p>
            <h2 className={h2}>
              「うちの子」を、
              <br />
              そのまま連れてこられます。
            </h2>
            <p className={`m-0 ${muted}`}>ほかのAIチャットで作った自分の作品の設定を貼るだけ。あなたの言葉はできるだけそのまま残して、yota の形に移します。</p>
          </div>
          <ol className="m-0 flex list-none flex-wrap gap-5 p-0">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex flex-[1_1_280px] flex-col gap-2 border-t border-[#3a3238] pt-5">
                <span className={`text-sm font-bold ${accent}`}>STEP {i + 1}</span>
                <strong className="text-[1.15rem]">{s.title}</strong>
                <span className={muted}>{s.body}</span>
              </li>
            ))}
          </ol>
          <p className="m-0 text-sm text-[#a39a96]">yota がほかのアプリにアクセスすることはありません。貼った文章も保存しません。</p>
          <div>
            <Link href={IMPORT} className={primary}>
              引っ越しをはじめる
            </Link>
          </div>
        </section>

        <section className="bg-[#17151b] px-5 py-24">
          <div className="mx-auto flex max-w-[1120px] flex-col gap-10">
            <div className="flex max-w-[44rem] flex-col gap-3.5">
              <p className={eyebrow}>作る道具</p>
              <h2 className={h2}>
                一行のアイデアから、
                <br />
                話せるキャラまで。
              </h2>
            </div>
            <div className="flex flex-wrap gap-x-10 gap-y-8">
              {TOOLS.map((t) => (
                <div key={t.title} className="flex flex-[1_1_300px] flex-col gap-1.5">
                  <h3 className="m-0 text-[1.1rem] font-bold">{t.title}</h3>
                  <p className={`m-0 ${muted}`}>{t.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {CREATOR_UPDATES.length > 0 && (
          <section className="mx-auto flex max-w-[1120px] flex-col gap-8 px-5 py-24">
            <div className="flex max-w-[44rem] flex-col gap-3.5">
              <p className={eyebrow}>変わったこと</p>
              <h2 className={h2}>作者さんの声で、変わったこと</h2>
              <p className={`m-0 ${muted}`}>いただいた声と、それでどう変わったかを、ここに残していきます。</p>
            </div>
            <ul className="m-0 flex list-none flex-col border-b border-[#3a3238] p-0">
              {CREATOR_UPDATES.map((u) => (
                <li key={`${u.date}-${u.voice}`} className="flex flex-wrap gap-x-8 gap-y-2 border-t border-[#3a3238] py-[22px]">
                  <span className="flex-[0_0_120px] text-[15px] text-[#a39a96]">{u.date.replaceAll("-", ".")}</span>
                  <span className="flex-[1_1_280px]">「{u.voice}」</span>
                  <span className={`flex-[1_1_280px] ${accent}`}>→ {u.change}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className={`px-5 pb-24 ${CREATOR_UPDATES.length > 0 ? "" : "pt-24"}`}>
          <div className="mx-auto flex max-w-[1120px] flex-col gap-[18px] rounded-3xl bg-[#241d24] p-[clamp(32px,6vw,64px)]">
            <p className={eyebrow}>はじまりの作者</p>
            <h2 className={`m-0 ${mincho} text-[clamp(1.7rem,4vw,2.4rem)] leading-[1.45]`}>
              最初に一緒に作ってくれた方の名前は、
              <br />
              ずっと残します。
            </h2>
            <p className={`m-0 max-w-[44rem] ${muted}`}>いま作品を寄せてくださる方を「はじまりの作者」として、作品ページとクレジットにお名前を載せます。</p>
            <p className={`m-0 max-w-[44rem] ${muted}`}>
              人気になった作品の作者さんに還元する形も、いま考えているところです。決まったら、はじまりの作者の方には真っ先にご相談します。
            </p>
          </div>
        </section>

        <section className="bg-[#17151b] px-5 py-24">
          <div className="mx-auto flex max-w-[820px] flex-col gap-8">
            <h2 className={h2}>よくある質問</h2>
            <div className="flex flex-col gap-7">
              {FAQ.map((f) => (
                <div key={f.q} className="flex flex-col gap-1.5">
                  <h3 className="m-0 text-[1.1rem] font-bold">{f.q}</h3>
                  <p className={`m-0 ${muted}`}>{f.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto flex max-w-[1120px] flex-col items-center gap-6 px-5 py-28 text-center">
          <h2 className={`m-0 ${mincho} text-[clamp(2rem,5vw,3.4rem)] leading-[1.35]`}>
            あなたの物語から、
            <br />
            yota をつくっていこう。
          </h2>
          <Buttons center />
          <p className={`m-0 ${muted}`}>
            {OPERATOR.x ? (
              <>
                要望や相談は、X の DM へ気軽にどうぞ。<a href={`https://x.com/${OPERATOR.x}`}>@{OPERATOR.x}</a>
              </>
            ) : (
              <>
                要望や相談は、アプリの「設定」→「ご意見・お問い合わせ」か、<Link href="/support">サポート</Link>から気軽にどうぞ。
              </>
            )}
          </p>
        </section>
      </main>

      <footer className="border-t border-[#2a2530] px-5 pb-[max(1.75rem,env(safe-area-inset-bottom))] pt-7">
        <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-3 text-sm text-[#a39a96]">
          <span className="flex items-center gap-3">
            <Logo className="h-6 w-auto text-[#efe9e4]" />
            <span>© 2026 {OPERATOR.name}</span>
          </span>
          <span className="flex flex-wrap gap-5">
            <Link href="/terms">利用規約</Link>
            <Link href="/privacy">プライバシーポリシー</Link>
            <Link href="/support">サポート</Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
