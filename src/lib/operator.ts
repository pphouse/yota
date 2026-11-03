/**
 * 運営者の情報。利用規約・プライバシーポリシー・サポートのページとホームの下に出す。ストアの審査ではここが空だと通らない。
 * 個人で出しているあいだは、名前は運営の名義（yota制作委員会）、住所の欄は「運営責任者の氏名と所在地は、ご請求があれば遅滞なくお知らせします」とする
 * （個人情報保護法では、運営者の氏名・住所などは、本人の求めに応じて遅滞なく答えられればよい）。会社を作ったら会社の情報に置きかえる。
 */
export const OPERATOR = {
  name: process.env.NEXT_PUBLIC_OPERATOR_NAME ?? "【会社名を入れる】",
  address: process.env.NEXT_PUBLIC_OPERATOR_ADDRESS ?? "【所在地を入れる】",
  email: process.env.NEXT_PUBLIC_OPERATOR_EMAIL ?? "【お問い合わせ用メールアドレスを入れる】",
};
