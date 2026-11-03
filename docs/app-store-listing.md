# App Store の掲載情報（案）

App Store Connect にそのまま貼れる形にしてある。文字数は App Store の上限に収まるよう数えてある（`node scripts/check-listing.mjs` で確かめられる）。

## 名前（30字まで）

App Store の中で同じ名前は使えない。上から順に試す。

1. yota - キャラと話す恋愛ストーリー
2. yota：推しと話す恋愛ノベル
3. yota - AIキャラと恋する物語

## サブタイトル（30字まで）

会話で進む、あなたとキャラの物語

## プロモーションテキスト（170字まで。審査なしで書きかえられる）

話しかけると、物語が動きだす。眠り王子の同級生、無口な喫茶店のマスター、犬猿の同期ふたり――キャラとの会話で進む恋愛ストーリー。ときどき見える「心の声」は、長押しでのぞけます。

## 説明（4000字まで）

キャラクターに話しかけると、物語が進む。
yota は、会話で読み進める恋愛ストーリーのアプリです。

■ 会話で進む物語
あなたが話しかけると、キャラが自分の言葉で返してくれます。返事の候補をタップするだけでも、自由に書いても。3往復目には物語が大きく動きます。

■ ふたつの遊び方
・あなたが主人公：キャラがあなたに話しかけ、あなたの言葉に応えます。
・ふたりを見守る：ふたりのやり取りを、少し離れたところから眺めます。「こうなってほしい」と送れば、その展開が起きます。

■ 見て楽しい演出
・心の声：キャラが口に出さない本音が、ぼかした文字で見えます。長押ししているあいだだけ読めます。
・言いかけた言葉：言いかけてやめた言葉に、打ち消し線が引かれます。
・山場のカットイン：物語が動く瞬間は、映画のような演出で。
・時間で変わる画面：深夜に開くと、画面もキャラも夜の空気になります。
・名場面カード：お気に入りの場面を、漫画のコマのようなカードにして保存・共有できます。

■ 作品をつくる
一行のアイデアから、AIが題名・キャラ・最初の一言まで下書きします。白紙から自分で書くことも、ほかのアプリで作った自分の作品を引っ越すこともできます。作った作品はリンクで友だちに遊んでもらえます。

■ 登録なし・広告なし・無料
年齢の確認と、物語の中で呼ばれる名前を決めるだけで、回数を気にせず遊べます。機種変更に備えて、メールアドレスで引き継ぎもできます（任意）。

■ 安心して遊べるように
・登場人物は、すべて18歳以上の架空の人物です。
・ほかの人の作品は「通報」「この作者をブロック」ができます。キャラの返答も報告できます。
・18歳未満の方には、表現の制限と1日の利用時間の上限があります。
・設定から、いつでもデータをすべて削除して退会できます。

キャラクターの返答は AI が作っています。事実と違うことを言う場合があります。

## キーワード（100字まで、読点ではなく半角カンマで区切る）

AIチャット,キャラチャット,恋愛,乙女ゲーム,BL,夢小説,ノベル,推し,物語,チャット小説,女性向け,イケメン,ストーリー

## カテゴリ

- プライマリ：エンターテインメント
- セカンダリ：ブック

## 年齢区分の質問票の答え方（目安）

正直に答える。区分が出たら、アプリの最低年齢（Vercel の `MIN_AGE`、今は 13）を区分に合わせる。

- 恋愛・性的なテーマ：まれ／軽度（キスを予感させる程度まで。性的な描写は書かない設定）
- 暴力：なし、またはまれ／軽度（物語の展開による）
- ユーザーが作るコンテンツ：あり（ユーザーが作った作品。通報・ブロックあり）
- ユーザーどうしのメッセージ：なし（話す相手は AI のキャラクターだけ）
- 広告：なし
- 医療・ギャンブル・薬物など：なし

## App のプライバシー（App Store Connect の答え方）

「データを収集していますか？」→ はい。どれも**トラッキングには使わない**（App Tracking Transparency の確認は出さない）。中身は `/privacy` と `docs/app-release.md` の「6. データの申告」と同じ。

| App Store の種類 | yota で集めるもの | 用途 | ユーザに関連付け |
| --- | --- | --- | --- |
| ユーザコンテンツ › その他のユーザコンテンツ | キャラとの会話、作った作品 | App の機能 | はい |
| ユーザコンテンツ › 写真またはビデオ | 作品のキャラに登録した画像（任意） | App の機能 | はい |
| ユーザコンテンツ › カスタマーサポート | ご意見・お問い合わせ・通報 | App の機能 | はい |
| 連絡先情報 › その他のユーザの連絡先情報 | ご意見に任意で書いた連絡先 | App の機能 | はい |
| 使用状況データ › 製品の操作 | どの作品を開いたか、押したボタン、利用時間 | アナリティクス、App の機能（18歳未満の利用時間の上限） | はい |
| その他のデータ › その他のデータの種類 | 生まれた年と月、物語の中の名前 | App の機能（年齢による制限） | はい |
| 連絡先情報 › メールアドレス | 引き継ぎのためにメールアドレスでログインした人のアドレス（コードを送るためだけに使い、保存は元に戻せない形） | App の機能 | はい |

- 「ユーザに関連付け」は、端末ごとのランダムな ID（cookie）で会話や設定をまとめているため「はい」にしておく（名前・メール・電話番号などの身元は集めない）。
- 「Xから生まれる彼」を有効にしたら、「ID › ユーザ ID」（X のユーザー名、任意）を足す。

## App Review への情報

- サインイン：不要（アプリには回数の上限もない。引き継ぎ用のメールアドレスのログインは任意。デモ用のアカウントはない）
- 連絡先：運営者の名前・電話番号・メールを入れる

### 審査メモ（英語）

```
yota is a Japanese interactive romance story app. Users talk with fictional AI characters and the story progresses through conversation.

No account is required to start. On first launch, the app asks for the user's birth year/month (age check) and a display name used inside the story. No email or phone number is collected.

Login is never required in the app, and there is no message limit in the app. Settings > "アカウント" offers an optional email login (a 6-digit code sent by email; our own account system, no passwords) so users can keep their data when they change devices. The app does not offer any third-party or social login.

How to test:
1. Open any story on the home screen (e.g. the first one in the carousel) and tap "物語をはじめる" (Start).
2. Type a message or tap one of the suggested replies. The character replies in a few seconds.
3. On the 2nd reply, a blurred "心の声" (inner voice) box appears; press and hold it to read.
4. Tap "カードにする" under the latest reply to create a shareable comic-style card (uses the native share sheet).

Safety and moderation (Guideline 1.2):
- All characters are fictional adults (18+). Sexual content is not generated; the AI is instructed to avoid it and outputs are filtered.
- User-created stories: each story page has "通報" (Report) and "この作者をブロック" (Block this creator). Blocked creators can be managed in Settings. Stories are listed publicly only after manual review by the operator.
- AI replies: the latest reply has "報告" (Report) to flag AI-generated content.
- Users under 18 get stricter content limits and a daily time limit.

Account deletion (5.1.1(v)): Settings > "データをすべて削除して退会する" deletes all data, including the login link. Settings > "ログアウト" logs out.

Native features (4.2): native share sheet for cards, in-app browser for external links, Android back button, splash screen, and an offline screen. The app content is served from our own website (yotachat.app), which we operate.

The "Xから生まれる彼" feature (optional, connect with X to generate a character) is currently disabled; it is not used for account creation.
```

## スクリーンショット

6.9インチ（1320×2868）。`docs/screenshots/` に置いた（本番の画面を撮ったもの）。並べる順の案：

1. ホーム（作品の一覧）
2. 会話（キャラの返事と返事の候補）
3. 心の声（ぼかしを長押しで読む）
4. 山場のカットイン
5. 作品をつくる
6. 名場面カード
