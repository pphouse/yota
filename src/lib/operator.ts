/**
 * 運営者の情報。利用規約・プライバシーポリシー・お問い合わせに出す。
 * 会社を作ったら、環境変数（または下の既定値）を正式な情報に置きかえる。ストアの審査ではここが空だと通らない。
 */
export const OPERATOR = {
  name: process.env.NEXT_PUBLIC_OPERATOR_NAME ?? "【会社名を入れる】",
  address: process.env.NEXT_PUBLIC_OPERATOR_ADDRESS ?? "【所在地を入れる】",
  email: process.env.NEXT_PUBLIC_OPERATOR_EMAIL ?? "【お問い合わせ用メールアドレスを入れる】",
};
