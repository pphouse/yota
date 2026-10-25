# yota

AIのキャラクターと物語を紡ぐWebアプリ（PWA）。最初の1,000人を集めるためのMVPです。

- **すぐ返ってくる**：返答を一文字ずつ流して表示。サーバーから最初のデータが届くまで数十ミリ秒（ダミー応答時）。
- **2つの遊び方**：「あなたが主人公」（夢小説型）と「ふたりを見守る」（自分は登場しない型）。
- **名場面カード**：返答の一節を画像カードにして、Xなどに共有できる。画像生成AIは使わないので原価ゼロ。
- **広告なし**。
- **安全**：年齢確認、未成年の表現制限と1日3時間の上限、入力と出力の安全判定、つらい気持ちのサインへの案内。

## 動かし方

```bash
npm install
cp .env.example .env.local   # キーを入れなければダミー応答で動きます
npm run dev                  # http://localhost:3000
```

テストと検査：

```bash
npm test          # ユニットテスト（vitest）
npm run lint
npm run build
```

## 文章AIの設定

`.env.local` にどれか1つのキーを入れると、自動でそれを使います（`LLM_PROVIDER` で明示も可）。

| 提供元 | 必要な変数 | 既定モデル |
| --- | --- | --- |
| Anthropic | `ANTHROPIC_API_KEY` | fast: `claude-haiku-5-5` / quality: `claude-sonnet-5-5` |
| OpenAI（互換API含む） | `OPENAI_API_KEY`, `OPENAI_MODEL_FAST` | なし（必ず指定） |
| Gemini | `GEMINI_API_KEY`, `GEMINI_MODEL_FAST` | なし（必ず指定） |

MVPでは全員 `fast` を使います。`quality` は有料化のときに使う想定です。
実際のAPIでの動作確認はまだしていません。キーを入れたら、まず1往復試してください。

## 本番公開（Vercel）

1. Vercel でこのリポジトリをインポートする。
2. Vercel はファイルに書き込めないため、[Turso](https://turso.tech) などで libSQL のDBを作り、`DATABASE_URL` と `DATABASE_AUTH_TOKEN` を設定する。テーブルは初回アクセス時に自動で作られます。
3. 文章AIのキーを設定する。

## 構成

```
src/
  app/
    page.tsx                 一覧（遊び方のタブ＋作品）
    chat/[plotId]/page.tsx   会話画面
    api/session              年齢確認（生まれた年月だけを保存）
    api/conversation         会話の取得・新規開始
    api/chat                 返答のストリーミング（NDJSON）
    api/messages/[id]        返答の手直し
    api/events               計測イベント
  components/                ChatScreen, AgeGate, SceneCard, StoryText, PlotList
  lib/
    characters.ts            公式キャラ・プロット（全員18歳以上の架空の人物）
    prompt.ts                システムプロンプト（視点、3往復で山場、安全の指示）
    chat.ts                  1往復の処理（判定→生成→流しながら判定→保存）
    safety.ts                入力・出力の安全判定
    memory.ts                長期記憶（古い会話をあらすじに要約）
    usage.ts                 未成年の利用時間
    llm/                     文章AIの差し替え層（Anthropic / OpenAI / Gemini / ダミー）
```

### 1往復の流れ

1. 入力を安全判定。問題があればAIに送らず、別の展開を促す。
2. あらすじ＋直近の会話＋キャラ設定でプロンプトを組み、返答を流す。
3. 流しながら出力も判定し、問題があればその場で差し替えて生成を止める。
4. 返答を送り終えてから、計測の記録と、必要ならあらすじの更新を行う（返答の速さに影響しない）。

## 計測

`events` テーブルに、`session_start`、`conversation_start`、`chat_send`（最初の文字までの時間を含む）、`regenerate`、`card_open`、`card_share`、`viewpoint_select` などを記録します。視点ごとの継続率や、カードの共有率の集計に使います。

## まだやっていないこと

- アカウント登録（今は端末ごとの匿名セッション）
- 判定モデルによる二次判定（`safety.ts` の `JudgeHook` に差し込む口だけある）
- 公式キャラ20本（今は4本）
- 有料化、ユーザーによるキャラ作成、漫画化
