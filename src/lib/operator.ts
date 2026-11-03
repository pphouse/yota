/**
 * 運営者の情報。利用規約・プライバシーポリシー・サポートのページに出す。ストアの審査ではここが空だと通らない。
 * 個人で出しているあいだは、名前は本名（App Store の販売元と同じ）、住所は「ご請求があれば遅滞なくお知らせします」でよい
 * （個人情報保護法では、本人の求めに応じて遅滞なく答えられれば、住所を載せなくてよい）。会社を作ったら会社の情報に置きかえる。
 */
export const OPERATOR = {
  name: process.env.NEXT_PUBLIC_OPERATOR_NAME ?? "【会社名を入れる】",
  address: process.env.NEXT_PUBLIC_OPERATOR_ADDRESS ?? "【所在地を入れる】",
  email: process.env.NEXT_PUBLIC_OPERATOR_EMAIL ?? "【お問い合わせ用メールアドレスを入れる】",
};
