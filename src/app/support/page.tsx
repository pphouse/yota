import type { Metadata } from "next";
import Link from "next/link";
import { H, LegalPage, Ul } from "@/components/legal/LegalPage";
import { OPERATOR } from "@/lib/operator";

export const metadata: Metadata = { title: "サポート — yota", description: "yota のお問い合わせ先と、よくある質問" };

/** サポート（App Store の「サポート URL」に使う）。問い合わせ先と、よくある質問 */
export default function SupportPage() {
  return (
    <LegalPage title="サポート" updated="2026年11月3日">
      <p>yota（Webサイト yotachat.app と iOS・Android アプリ）についてのお問い合わせ先と、よくある質問です。</p>

      <H>お問い合わせ</H>
      <Ul>
        <li>アプリ・サイトの「設定」→「ご意見・お問い合わせ・通報」から送れます（返事がほしいときは、連絡先を書いてください）。</li>
        <li>メール：{OPERATOR.email}</li>
        <li>いただいた内容はすべて読んでいます。返事が必要なものには、数日以内にお返事します。</li>
      </Ul>

      <H>よくある質問</H>
      <p className="mt-3 font-bold">登録は必要ですか？</p>
      <p className="mt-1">
        いりません。年齢の確認と、物語の中で呼ばれる名前を決めるだけで、ゲストとして遊べます。ゲストで話せる回数には上限があり、続けて話すときは LINE・Google・Apple のどれかでログインしてください（ゲストのときの会話と作品は、そのまま引き継がれます）。
      </p>
      <p className="mt-3 font-bold">ログインすると、何が分かってしまいますか？</p>
      <p className="mt-1">
        本サービスが受け取るのは、アカウントを見分けるためのIDだけです。メールアドレス・電話番号・本名は受け取らず、あなたのアカウントで投稿することもありません。
      </p>
      <p className="mt-3 font-bold">機種変更したら、続きから遊べますか？</p>
      <p className="mt-1">ログインしていれば、新しい端末で同じ方法でログインすると続きから遊べます。年齢の確認の画面の「以前ログインした方はこちら」からログインしてください。</p>
      <p className="mt-3 font-bold">データを消したい・やめたいときは？</p>
      <p className="mt-1">「設定」→「データをすべて削除して退会する」で、会話・作った作品・設定・ログインのつながりがすべて消えます。ログアウトだけなら、記録はアカウントに残り、もう一度ログインすると戻ります。</p>
      <p className="mt-3 font-bold">問題のある作品や返答を見つけたら？</p>
      <p className="mt-1">ほかの人が作った作品は、作品のページの「通報」から知らせられ、「この作者をブロック」で見えなくできます。キャラクターの返答は、返答の下の「報告」から知らせられます。運営が確認して対応します。</p>
      <p className="mt-3 font-bold">何歳から使えますか？</p>
      <p className="mt-1">13歳以上の方が対象です。18歳未満の方には、表現の制限と1日の利用時間の上限があります。登場人物はすべて18歳以上の架空の人物です。</p>
      <p className="mt-3 font-bold">料金はかかりますか？</p>
      <p className="mt-1">いまはすべて無料です。広告もありません。</p>
      <p className="mt-3 font-bold">キャラクターの返答はだれが書いていますか？</p>
      <p className="mt-1">AI が作っています。事実と違うことを言う場合があります。</p>

      <H>運営者</H>
      <p className="mt-2">{OPERATOR.name}</p>
      <p className="mt-4">
        <Link href="/terms" className="underline">
          利用規約
        </Link>
        {" ・ "}
        <Link href="/privacy" className="underline">
          プライバシーポリシー
        </Link>
      </p>
    </LegalPage>
  );
}
