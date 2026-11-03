# iOS / Android アプリを出すまで

yota のアプリは Capacitor で作っています。アプリは本番の https://yotachat.app を読み込み、共有・通知・戻るボタン・外部リンク・起動画面だけをネイティブで動かします。Web を直せば、アプリにもそのまま反映されます（審査に出し直すのは、ネイティブ側を変えたときだけ）。

- 設定：`capacitor.config.ts`（アプリのID は `app.yotachat`。一度ストアに出すと変えられない）
- ネイティブとのつなぎ：`src/lib/native.ts`、`src/components/NativeBridge.tsx`
- ネイティブのプロジェクト：`ios/`、`android/`
- アイコンと起動画面の元画像：`assets/`（作り直すときは `npx @capacitor/assets generate --iconBackgroundColor '#0f0f13' --splashBackgroundColor '#0f0f13'`）

## 0. いまの進め方：iOS を個人で先に出し、会社の準備を並行する

Apple は、個人のアカウントで出したアプリを、あとで同じアカウントのまま会社（組織）に切り替えられる（アプリ・評価・TestFlight はそのまま、販売元の名前が会社名に変わる）。そこで iOS は個人で先に出し、会社ができたら切り替える。Android は会社ができてから組織のアカウントで出す（個人だと「12人で14日間のテスト」が要り、あとで組織のアカウントへアプリを移すことにもなるため）。

1. **Apple Developer Program に個人で登録する**（年 99 USD、円で請求）
   - 2ファクタ認証を入れた Apple ID と、身分証と同じ本名が要る。iPhone の「Apple Developer」アプリから登録すると、本人確認が早い。
   - App Store の「販売元」には本名が出る（会社に切り替えると会社名になる）。
2. **運営者の情報を Vercel に入れる**（入れないと規約などに【会社名を入れる】と出たままで、審査に通らない）。入れたら再デプロイし、`/terms`・`/privacy`・`/support` で確かめる。
   ```bash
   NEXT_PUBLIC_OPERATOR_NAME=（本名。App Store の販売元と同じにする）
   NEXT_PUBLIC_OPERATOR_ADDRESS=所在地は、ご請求があれば遅滞なくお知らせします
   NEXT_PUBLIC_OPERATOR_EMAIL=（問い合わせ用のメールアドレス）
   ```
   - 個人のあいだは、住所を載せず「ご請求があれば遅滞なくお知らせします」でよい（個人情報保護法では、本人の求めに応じて遅滞なく答えられればよい）。
   - 問い合わせ用のメールは、`support@yotachat.app` を作るならメールの転送サービスで yotachat.app の MX を設定する（Vercel の DNS に追加）。すぐ用意できなければ、専用の Gmail でもよい。
3. **App Store Connect でアプリを作る**（掲載文・キーワード・審査メモの案は `docs/app-store-listing.md`）
   - アプリ名は App Store の中で重複できない。「yota」が使われていたら、案の中から選ぶ。
   - Bundle ID は `app.yotachat`。
   - 配信する国は、最初は**日本だけ**にする。アプリが日本語だけなのと、EU で配信するとデジタルサービス法で「トレーダー」かどうかの申告が要り、トレーダーなら住所と電話番号がストアに出るため。
   - 無料のアプリなので、有料アプリの契約・口座・税の登録はまだ要らない。
   - URL：プライバシーポリシー `https://yotachat.app/privacy`、サポート `https://yotachat.app/support`、マーケティング `https://yotachat.app`。
4. **ビルドして TestFlight で試し、審査に出す**（下の「3. iOS」の手順。Team は自分の個人の Team を選ぶ）
   - 最初は iPhone だけに対応する（`TARGETED_DEVICE_FAMILY = 1`。iPad のスクリーンショットと iPad での審査を省くため）。iPad 対応はあとから足せる。
   - アップロードのあとに Apple から警告のメール（例：ITMS-91053 のプライバシーマニフェスト）が来たら、内容に合わせて直す。Capacitor 8 の部品には、それぞれのプライバシーマニフェストが入っている。

## 1. 会社でやること（並行して進める）

おおよその流れ：法人の設立（1〜3週間）→ 法人口座と D-U-N-S 番号（1〜2週間）→ Apple の切り替え・Google の組織アカウント（数日〜1週間）。iOS を個人で出しているあいだに進める。

| やること | 目安 | メモ |
| --- | --- | --- |
| 法人の設立 | 合同会社なら1〜2週間（費用の目安は約6〜10万円）、株式会社なら2〜3週間（約20〜25万円） | Apple の組織にするには、登記された法人が要る（個人事業主のままでは不可）。1人で作った会社でよい |
| 法人名義の銀行口座 | 1〜3週間 | ストアの売上の振込先になる |
| D-U-N-S 番号の取得 | 1〜2週間・無料 | 登記のあとに、Apple の開発者サイトの「D-U-N-S 番号の検索」から申請する（日本では東京商工リサーチが発行）。会社名・住所は登記と同じにする |
| Web サイトとドメインのメール | — | Apple の組織の登録では、会社と結びついた Web サイトと、そのドメインのメールを求められる。yotachat.app と support@yotachat.app で足りる |
| Apple：個人から組織への切り替え | 数日〜1週間 | 開発者アカウントのメンバーシップの画面から申請する（見つからなければ Apple Developer のサポートに連絡）。申請するのは創業者か共同創業者。アプリ・評価・TestFlight はそのまま、販売元の名前が会社名に変わる。切り替えのあと Team ID が変わっていないか確かめる |
| Google Play Console（組織） | 1回 25 USD | 組織の確認書類と D-U-N-S 番号が要る。組織アカウントは「12人で14日間のテスト」の条件がない |
| 運営者の情報を会社に置きかえる | — | Vercel の `NEXT_PUBLIC_OPERATOR_*` を会社の名前・所在地・メールにして再デプロイ |
| 課金を入れるなら | — | 会社に切り替えてから、有料アプリの契約・口座・税の登録をする（下の「7. 課金」） |

会社ができたら、Vercel の環境変数の運営者の情報を会社のものにする（個人のあいだの入れ方は「0.」の2）。

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

### はじめの1回

- Mac に、App Store から最新の **Xcode** を入れて一度開く（追加の部品を入れるか聞かれたら入れる）。Node.js は 22 などの LTS。
- Xcode → Settings → Accounts で、開発者登録した Apple ID を足す（Team に「大塚直人（Individual）」が出る）。
- ネイティブの部品は Swift Package Manager で入る（CocoaPods は使わない）。

### ビルドして TestFlight に上げる

1. ```bash
   git clone https://github.com/pphouse/yota.git && cd yota   # 2回目からは git pull
   npm ci
   npx cap sync ios
   npx cap open ios   # Xcode が開く
   ```
2. 左の一覧で「App」→ TARGETS の「App」→ **Signing & Capabilities**：
   - 「Automatically manage signing」にチェック、Team は自分の Team（個人。会社に切り替えても同じ Team のまま）、Bundle Identifier は `app.yotachat`。
   - 「＋ Capability」で **Push Notifications** と **Associated Domains** を足し、Associated Domains に `applinks:yotachat.app` を入れる。
3. **General** で Version を `1.0`、Build を `1` にする（上げ直すたびに Build を 2、3…と増やす）。
4. 上の実行先を「**Any iOS Device (arm64)**」にして、**Product → Archive**。終わると Organizer が開く。
5. **Distribute App → App Store Connect → Upload**（そのまま次へ）。10〜30分ほどで App Store Connect の TestFlight に出る。
6. App Store Connect の **TestFlight → 内部テスト** に自分を足し、iPhone に「TestFlight」アプリを入れて試す。
7. Vercel の環境変数に `APPLE_TEAM_ID`（10文字）を入れて再デプロイする。`/.well-known/apple-app-site-association` が返り、yotachat.app のリンクがアプリで開くようになる。

### 審査に出す

App Store Connect の「配信」のページで、次を入れて「審査用に追加」→「審査に提出」。

- スクリーンショット（6.9インチ）：`docs/screenshots/` の6枚
- 名前・サブタイトル・説明・キーワード・プロモーションテキスト・サポート URL：`docs/app-store-listing.md`
- ビルド：TestFlight に上げたもの
- App Review に関する情報：サインインは不要、審査メモは `docs/app-store-listing.md` の英文、連絡先
- 「App のプライバシー」：`docs/app-store-listing.md` の答え方
- 年齢区分・価格（無料）・配信する国（日本だけ）

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
