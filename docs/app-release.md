# iOS / Android アプリを出すまで

yota のアプリは Capacitor で作っています。アプリは本番の https://yotachat.app を読み込み、共有・通知・戻るボタン・外部リンク・起動画面だけをネイティブで動かします。Web を直せば、アプリにもそのまま反映されます（審査に出し直すのは、ネイティブ側を変えたときだけ）。

- 設定：`capacitor.config.ts`（アプリのID は `app.yotachat`。一度ストアに出すと変えられない）
- ネイティブとのつなぎ：`src/lib/native.ts`、`src/components/NativeBridge.tsx`
- ネイティブのプロジェクト：`ios/`、`android/`
- アイコンと起動画面の元画像：`assets/`（作り直すときは `npx @capacitor/assets generate --iconBackgroundColor '#0f0f13' --splashBackgroundColor '#0f0f13'`）

## 1. 会社でやること（時間がかかるので最初に）

| やること | 目安 | メモ |
| --- | --- | --- |
| 法人の設立と、法人名義の銀行口座 | 2〜4週間 | ストアの売上の振込先になる |
| D-U-N-S 番号の取得 | 1〜2週間・無料 | Apple と Google の組織アカウントの両方で必要。Apple の開発者サイトから申請できる |
| Apple Developer Program（組織） | 年 99 USD | D-U-N-S 番号、法人の Web サイト、法人ドメインのメールが要る |
| Google Play Console（組織） | 1回 25 USD | 組織の確認書類と D-U-N-S 番号が要る。組織アカウントは「12人で14日間のテスト」の条件がない |
| 問い合わせ用のメールアドレス | — | 規約・ポリシー・ストアの掲載情報に出す |

会社ができたら、Vercel の環境変数に運営者の情報を入れる（入れないと規約とポリシーに【会社名を入れる】と出たままになり、審査に通らない）。

```bash
NEXT_PUBLIC_OPERATOR_NAME=株式会社〇〇
NEXT_PUBLIC_OPERATOR_ADDRESS=東京都〇〇区…
NEXT_PUBLIC_OPERATOR_EMAIL=support@yotachat.app
```

## 2. ストアの審査に向けて入れたもの

| 求められること | yota での対応 |
| --- | --- |
| Web を包んだだけのアプリは不可（Apple 4.2） | 共有シート、通知、戻るボタン、アプリ内ブラウザ、起動画面をネイティブで動かす |
| ユーザー投稿の作品の通報・ブロック・連絡先（Apple 1.2） | 作品のページに「通報」「この作者をブロック」。設定で解除。規約とポリシーに連絡先 |
| AI が作った内容をアプリ内で報告できる（Google Play の AI 生成コンテンツの方針） | 会話の最後の返答に「報告」 |
| アプリの中から退会できる（Apple 5.1.1(v)、Google Play） | 設定の「データをすべて削除して退会する」（`DELETE /api/session`） |
| プライバシーポリシーと利用規約 | `/privacy`、`/terms`（設定から開ける） |
| 写真とカメラを使う理由（iOS） | `Info.plist` に書いた |

### 審査で気をつけること

- **年齢区分**：恋愛ものなので、Apple の年齢区分の質問票と Google の IARC には正直に答える。区分が 13 歳以上より上（16+ や 18+）になったら、アプリの最低年齢（環境変数 `MIN_AGE`、今は 13）を区分に合わせる。
- **X でログイン**：アカウントを作るためではなく「Xから生まれる彼」の機能のための連携なので、Sign in with Apple は要らない、という整理。審査で聞かれたらそう説明する。
- **アプリ内での課金**：今は有料の機能がないので対応なし。有料にするときは下の「課金」を読む。
- **審査用の説明**：「登録なしで、年齢確認だけで使える」ことと、通報とブロックの場所を、審査メモに書く。

## 3. iOS（Mac が必要）

1. `npm install` → `npx cap sync ios` → `npx cap open ios`（Xcode が開く）
2. Signing & Capabilities で、会社の Team を選ぶ。Bundle Identifier は `app.yotachat`。
3. Capabilities を足す：**Push Notifications**、**Associated Domains**（`applinks:yotachat.app`）。
4. Vercel の環境変数に `APPLE_TEAM_ID`（10文字）を入れる。`/.well-known/apple-app-site-association` が自動で返る。
5. Product → Archive → App Store Connect にアップロード → TestFlight で自分の端末で試す。
6. App Store Connect で、スクリーンショット（6.9インチ・6.5インチ）、説明文、プライバシーの項目（「6. データの申告」）、年齢区分を入れて審査に出す。

## 4. Android

1. 署名の鍵を作る（なくすと更新できなくなるので、会社の安全な場所に保管する）：
   ```bash
   keytool -genkey -v -keystore yota-upload.jks -alias yota -keyalg RSA -keysize 2048 -validity 10000
   ```
2. `npx cap sync android` → `cd android && ./gradlew bundleRelease`（署名の設定は Android Studio の Generate Signed Bundle が簡単）
3. Play Console で「Play アプリ署名」を使い、`.aab` を内部テストに上げる。
4. Play Console の「アプリの署名鍵」の SHA-256 を、Vercel の `ANDROID_CERT_SHA256` に入れる。`/.well-known/assetlinks.json` が自動で返り、yotachat.app のリンクがアプリで開くようになる。
5. ストアの掲載情報、データ セーフティ（「6. データの申告」）、コンテンツのレーティング、対象年齢を入れて審査に出す。

手元で試すだけなら、`./gradlew assembleDebug` で `android/app/build/outputs/apk/debug/app-debug.apk` ができる（Android SDK 36 と JDK 21 が要る）。

## 5. 通知

通知の仕組み（許可をもらう・端末を登録する・押したら画面を開く）は入れてあるが、送る側の設定がまだなので、`NEXT_PUBLIC_PUSH_ENABLED` を `1` にするまで設定画面に出さない（設定がないまま Android で登録すると、アプリが落ちる）。

1. Firebase のプロジェクトを作り、Android アプリ（`app.yotachat`）を足して `google-services.json` を `android/app/` に置く。
2. Apple Developer で APNs の鍵（.p8）を作る。
3. 端末のトークンは `push_tokens` テーブルにたまる（`POST /api/push`）。送る処理（APNs / FCM へ送る API）はまだないので、送りたい内容が決まったら作る。
4. 準備ができたら `NEXT_PUBLIC_PUSH_ENABLED=1`。

## 6. データの申告（App Store のプライバシー、Google Play のデータ セーフティ）

`/privacy` と同じ内容で答える。

| データ | 集める | 用途 | 第三者に送る |
| --- | --- | --- | --- |
| 生まれた年と月 | はい | 年齢による制限 | いいえ |
| 物語の中の名前 | はい | 機能 | 文章を作るAI |
| 会話の内容・作った作品 | はい | 機能、安全のための確認 | 文章・画像を作るAI |
| 画像（作品のキャラの絵） | はい（任意） | 機能 | いいえ |
| 利用状況・利用時間 | はい | 改善、18歳未満の上限 | いいえ |
| ご意見・連絡先 | はい（任意） | 問い合わせへの対応 | いいえ |
| X のユーザー名と診断結果 | はい（任意） | 機能 | X（読み取り） |
| 端末のトークン | はい（通知をオンにした人） | 通知 | Apple / Google |

- 広告やトラッキングには使わない（App Tracking Transparency の確認は出さない）。
- 通信はすべて暗号化（HTTPS）。退会でデータを消せる。

## 7. 課金（有料にするとき）

- アプリの中で売るデジタルの中身（会話の回数、上位のAI、話し放題など）は、原則としてストアの課金（Apple の In-App Purchase、Google Play Billing）を使う。手数料は 15〜30%（小規模事業者向けの 15% の制度がある）。
- 日本では、スマホソフトウェア競争促進法（2025年12月全面施行）で、アプリから外部の決済に案内しやすくなった。条件と手数料は出す時点の各社の規約で確かめる。
- Web（yotachat.app）での決済は手数料がかからない。アプリからの通信には User-Agent に `YotaApp` が付くので、規約の範囲で、アプリとブラウザで決済の出し方を分けられる。
