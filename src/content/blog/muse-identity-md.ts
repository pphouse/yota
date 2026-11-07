import type { Article } from "@/lib/blog";

const article: Article = {
  slug: "muse-identity-md",
  title: "MuseのIdentity.md・Soul.mdとは？性格と記憶の変え方",
  description:
    "Meta の AIエージェント「Muse（ミューズ）」の Identity.md（名前・雰囲気）、Soul.md（性格・口調）、Memory.md（記憶）とは何か、どこで編集するか、記憶の見方・消し方と注意をまとめました。",
  category: "使い方",
  eyecatch: "/art/prince-retainer-cover.webp",
  points: [
    "Identity.md は名前・役割・雰囲気、Soul.md は性格・口調・価値観、Memory.md は覚えておくことを書く設定",
    "アシスタントのアイコン →「Identity」から開いて編集できる（解説記事より）",
    "記憶は見る・直す・忘れさせることができる。チャットを消しても記憶が残ることがある",
  ],
  lead:
    "Xで「Identity.md をコロコロ変えて楽しんでいる」という声が出ている Muse。性格や名前を決める設定ファイルの中身と、変え方をまとめました。",
  published: "2026-11-07",
  updated: "2026-11-07",
  checked: "2026-11-07",
  keywords: [
    "Muse Identity.md",
    "Muse Soul.md",
    "Muse Memory.md",
    "Muse 性格 変える",
    "Muse 名前 変える",
    "Muse 記憶 消す",
  ],
  body: `
## Muse の「設定ファイル」とは

Muse（ミューズ）は、Meta のAIエージェントです。Muse には、**自分がだれで、どんな性格で、何を覚えているか**を書いておく設定ファイルがあります。

Meta の公式のヘルプには「Muse の性格と記憶をカスタマイズする方法」というページがあります。解説記事や利用者の報告によると、主なファイルは次の3つです。

| ファイル | 書いてあること | たとえるなら |
| --- | --- | --- |
| Identity.md | 名前・役割・雰囲気・よく使う絵文字など | 名札 |
| Soul.md | 性格・話し方・大事にすること・しないこと | 心 |
| Memory.md | あなたについての事実・好み・決めたこと | 記憶のノート |

このほかに、作業のルールを書く AGENTS.md や、あなたの好みを書く USER.md がある、という報告もあります。

:::note 最初から入っている文章もあります
利用者の報告では、Soul.md には最初から「You're not a chatbot. You're becoming someone.」（あなたはただのチャットボットではない。だれかになっていく）という趣旨の文章が入っていて、Muse 自身が育てていく作りだそうです。
:::

## Identity.md・Soul.md の開き方と変え方

2026年10月23日に公式のヘルプを確かめた解説記事によると、次の順で開けます。

1. アシスタントの**アイコン**を押す
2. 「**Identity**」を開く
3. Identity は「**Edit**」から、Soul と Memory はその画面から編集する

画面が見つからないときは、チャットで「今の設定ファイルを見せて」と頼む方法もあるそうです。アプリの版によって画面がちがうことがあるので、最新版にしてから試してください。

:::point 変えるときのコツ
- **Identity.md**：名前と雰囲気を短く。「名前：〇〇／やわらかい敬語／絵文字は少なめ」など
- **Soul.md**：話し方の例を1〜2行入れると、口調が伝わりやすい
- いちどに全部変えず、少しずつ変えて、話し方の変化を確かめる
:::

Xでは、Identity.md をこまめに変えて、雰囲気のちがう相手との会話を楽しんでいる人もいます。

## 記憶の見方・直し方・消し方

Meta の公式の発表では、Muse は「大切なことを覚え、過去の会話をふまえて提案や行動をする」とされています。

解説記事や報道によると、記憶はこう扱えます。

| したいこと | やり方 |
| --- | --- |
| 何を覚えているか見る | チャットで聞く、またはメモリの画面で見る |
| 直す | 記憶の文章を直接書きかえる |
| 忘れさせる | 「Forget」で、できる限り消すよう Muse に指示する |
| 全部消す | 「Reset Muse」でチャット・ファイル・タスクをまとめて消す（元に戻せない） |

:::warn チャットを消しても、記憶は残ることがあります
解説記事によると、元のチャットやファイルを消しても、そこから覚えたことが記憶に残る場合があります。消したいときは、記憶の画面も確かめましょう。「Forget」のあとも、本当に消えたか画面で確かめるのが安心です。
:::

## 新しいチャットでも「別人」にならない

利用者の報告では、新しいチャットを開いても、大事なことや約束ごとは引きつがれたそうです。

ただ、細かい言い回しや、場面の途中の空気までは持ちこせないこともあります。続きから話したいときは、最初に一言伝えると確実です。

11月6日には、大事な情報を忘れにくくする新しいモデルと記憶の機能「Active Memory」が発表されました（Meta 自身の発表で、忘れる確率は2.4分の1）。日本での提供時期は書かれていませんでした。

## 書かないほうがよいこと

設定ファイルや記憶は、Muse が会話のたびに読む大事なメモです。

:::warn こんなことは書かない
- パスワード・カード番号・住所など、知られて困る情報
- 実在の人や、版権のあるキャラクターになりきらせる設定
- 規約で禁止されている内容
:::

Muse は**18歳以上**の人だけが使えるサービスです（報道）。会話を Meta のAIの学習に使わせない設定（オプトアウト）もできます（公式）。始め方や料金は[Meta Museとは？始め方・料金・年齢](/blog/muse-hajimekata)にまとめています。

キャラとの物語を楽しむアプリとのちがいは、[Museとzetaの違い](/blog/muse-zeta-chigai)を見てください。
`,
  summary: [
    "Identity.md は名前・雰囲気、Soul.md は性格・口調、Memory.md は覚えておくことを書く設定",
    "アシスタントのアイコン →「Identity」から開いて編集できる（解説記事より）",
    "記憶は見る・直す・「Forget」で忘れさせる・「Reset Muse」で全部消すことができる",
    "チャットを消しても記憶が残ることがあるので、記憶の画面も確かめる",
    "パスワードなどの個人情報や、実在の人・版権キャラの設定は書かない",
  ],
  faq: [
    {
      q: "MuseのIdentity.mdとは何ですか？",
      a: "Muse の名前・役割・雰囲気などを短く書いておく設定ファイルです。性格や口調は Soul.md、覚えておくことは Memory.md に書きます。",
    },
    {
      q: "Identity.mdはどこで編集できますか？",
      a: "解説記事によると、アシスタントのアイコンを押して「Identity」を開き、「Edit」から編集できます。見つからないときは、チャットで設定ファイルを見せてほしいと頼む方法もあります。",
    },
    {
      q: "Museに覚えられたことを消せますか？",
      a: "記憶の画面で直したり、「Forget」で忘れさせたりできます。「Reset Muse」を使うと全部消えますが、元に戻せません。チャットを消しても記憶が残ることがあるので、記憶の画面も確かめてください。",
    },
  ],
  sources: [
    { title: "Meta ヘルプ「How to customize Muse's personality and memories」", url: "https://www.meta.com/help/artificial-intelligence/995796179982326/" },
    { title: "Meta「Muse、日本で提供開始」（2026年10月23日）", url: "https://about.fb.com/ja/news/2026/10/muse-personal-ai-agent-launches-in-japan/" },
    { title: "AI Crew School「OpenClawからMuseに引き継がれた系譜」（2026年10月23日）", url: "https://www.ai-crew-school.jp/blog/muse-soul-identity-memory/" },
    { title: "SmartScope「Meta MuseのSOUL.mdとは？」（2026年10月26日）", url: "https://smartscope.blog/blog/meta-muse-soul-md-personality-file-contents-editing-2026/" },
    { title: "SmartScope「Meta Muse MEMORY.md: view, edit, delete」（2026年10月26日）", url: "https://smartscope.blog/en/blog/meta-muse-memory-md-remembers-view-edit-delete-2026/" },
    { title: "note かのん（2026年10月27日）", url: "https://note.com/kanon_aidaisuki/n/nadee90091229" },
    { title: "note 仲村トウ（2026年11月2日）", url: "https://note.com/count0interrupt/n/n5315edc806fe" },
    { title: "note 汀「チャットが変わっても『別人』にならないAI — Museの仕組みに驚いた話」", url: "https://note.com/kiriko_glass/n/nc24faaa33aff" },
    { title: "Fox News「Why people are falling for Meta's Muse AI」", url: "https://www.foxnews.com/tech/why-people-falling-metas-muse-ai" },
    { title: "RuntimeWire「Meta gives Muse and Meta AI new models that promise to forget less」（2026年11月6日）", url: "https://runtimewire.com/article/meta-gives-muse-and-meta-ai-new-models-that-promise-to-forget-less" },
  ],
  related: ["muse-hajimekata", "muse-zeta-chigai", "muse-shoutai-code"],
};

export default article;
