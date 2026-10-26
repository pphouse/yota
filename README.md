# yota

AIのキャラクターと物語を紡ぐWebアプリ（PWA）。最初の1,000人を集めるためのMVPです。

- **すぐ返ってくる**：最初の文字はすぐ出し、そのあとは人が書くくらいの速さ（約50文字/秒、句読点で少し間をあける）で見せる。文章AIが長文を一瞬で返しても、貯めておいて少しずつ出す（`src/lib/typewriter.ts`）。表示中の返答をタップすると残りを一気に出せる。
- **返事の候補**：最初の一言には作品ごとの候補、そのあとはキャラが返すたびに、場面に合った候補を3つ文章AIに作らせて出す（`src/lib/suggest.ts`）。
- **2つの遊び方**：「あなたが主人公」（夢小説型）と「ふたりを見守る」（自分は登場しない型）。
- **物語に入りこむ**：最初に自分の名前を決め（ホームの右上からあとで変えられる）、主人公モードではキャラも地の文もその名前で呼ぶ。返答は、吹き出しの中に斜体の動作（`*…*`）、吹き出しの外に周りの情景（`>` で始まる行）を出す。会話の最初には作品ごとのプロローグを情景として出す。
- **作品の紹介ページ**（`/plot/[plotId]`）：表紙・紹介文・あなたの役・登場人物のプロフィール（見た目・性格・好き嫌い・口癖・一人称／二人称・好きになったら）を見せてから始める。
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
| Cerebras（OpenAI互換） | 上の2つ＋`OPENAI_BASE_URL`, `OPENAI_REASONING_EFFORT` | 下を参照 |
| Gemini | `GEMINI_API_KEY`, `GEMINI_MODEL_FAST` | なし（必ず指定） |

MVPでは全員 `fast` を使います。`quality` は有料化のときに使う想定です。

### 今使っている設定：Cerebras の qwen-3.8-27b

```bash
LLM_PROVIDER=openai
OPENAI_API_KEY=csk-...                       # Cerebras のキー
OPENAI_BASE_URL=https://api.cerebras.ai/v1
OPENAI_MODEL_FAST=qwen-3.8-27b
OPENAI_REASONING_EFFORT=medium
```

- ユーザー像5人（夢女子2・腐女子2・会話が苦手な初心者1）になりきった Claude に、4ラウンド遊ばせて評価し、プロンプトを直した（2026-10-25）。噛み合い・キャラらしさ・日本語・返しやすさ・ときめき・展開・候補ボタンの7項目（5点満点）で、同じ10作品の平均は 2.94 → 3.62 → 3.83。
- gpt-oss-120b より日本語が自然で、キャラの口調も保ちやすい。一方で、他の言語の文字が混ざったり（作り直す。`japanese.ts`）、返答をまるごと推論の側に書いて本文が空になったり（もう一度流す。`chat.ts`）することがある。
- 返答の長さはプロンプトで指定している（主人公モード80〜180字、主人公モードで二人いる作品は100〜200字、見守りモード120〜220字。地の文は2〜3つ、情景の行は1つまで）。動作と情景で場面が浮かぶ長さにしつつ、読む負担が大きくなりすぎないようにしている。
- 推論モデルなので、推論の分も `max_completion_tokens` の枠を使います。`openai.ts` が推論の量に応じた余裕（low +3000、medium +6000、high +10000）を自動で足します。推論の途中経過（`delta.reasoning`）は画面に出さず、本文だけを流します。
- `medium` にしているのは、`none`（推論なし）だと最初の文字まで0.2〜0.4秒と速いものの、見守りで片方しか喋らなくなるなど品質が下がったため（7項目の平均 3.11 対 medium 3.40）。速さの差は体感ではほぼ分からなかった。
- 返事の候補は短いので、考える量を別に `OPENAI_SUGGEST_REASONING_EFFORT` で減らせます（既定は `low`）。`none` にすると速くなりますが、評価では候補の日本語や口調が崩れやすかったため、`low` のままにしています。
- `OPENAI_REASONING_EFFORT` は推論モデルにだけ設定します（推論しないモデルに送るとエラーになります）。

### gpt-oss-120b に戻す場合

```bash
OPENAI_MODEL_FAST=gpt-oss-120b   # ほかは上と同じ
```

- 最初の文字まで約0.3秒と速いが、日本語の言い回しが不自然になりやすい。`low` だとキャラ設定や「同じことを繰り返さない」などの指示が守られにくかったので、`medium` で使う。`OPENAI_SUGGEST_REASONING_EFFORT=none` は受け付けない。

Anthropic と Gemini の実際のAPIでの動作確認はまだしていません。

## 本番公開（Vercel）

1. Vercel でこのリポジトリをインポートする。
2. Vercel はファイルに書き込めないため、[Turso](https://turso.tech) などで libSQL のDBを作り、`DATABASE_URL` と `DATABASE_AUTH_TOKEN` を設定する。Vercel の Marketplace から Turso を入れた場合は `TURSO_DATABASE_URL` と `TURSO_AUTH_TOKEN` が自動で入り、そのまま読みます。テーブルは初回アクセス時に自動で作られます。
3. 文章AIの設定（上の「今使っている設定」の5つ）を環境変数に入れる。

## 構成

```
src/
  app/
    page.tsx                 ホーム（5秒ごとに切り替わる注目作＋キャンパスの物語の棚＋遊び方のタブ・カテゴリ・ハッシュタグで絞りこめる2列の作品一覧）
    plot/[plotId]/page.tsx   作品の紹介ページ（紹介文・あなたの役・登場人物のプロフィール）
    chat/[plotId]/page.tsx   会話画面
    api/session              年齢確認と名前（生まれた年月と、物語の中で呼ばれる名前だけを保存）
    api/conversation         会話の取得・新規開始
    api/chat                 返答のストリーミング（NDJSON）
    api/suggest              次の返事の候補（キャラが返すたびに3つ）
    api/messages/[id]        返答の手直し
    api/events               計測イベント
  components/                ChatScreen, AgeGate, UserName, SceneCard, StoryMessage, Featured, Shelf, PlotList, StartButtons, Avatar
  lib/
    characters.ts            公式キャラ・プロット26本（全員18歳以上の架空の人物。学園ものは大学が舞台）
    story.ts                 返答を台詞・地の文・情景に分け、吹き出しにまとめる
    username.ts              名前の検証と、地の文の「あなた」の置き換え
    prompt.ts                システムプロンプト（視点、3往復で山場、安全の指示）
    chat.ts                  1往復の処理（判定→生成→流しながら判定→保存）
    safety.ts                入力・出力の安全判定
    memory.ts                長期記憶（古い会話をあらすじに要約）
    usage.ts                 未成年の利用時間
    llm/                     文章AIの差し替え層（Anthropic / OpenAI / Gemini / ダミー）
```

性格ベクトル（activation steering）で、キャラの性格を調整する実験の道具と指示書は `steering/` にある（`steering/INSTRUCTIONS.md`。DGX Spark で、モデルとベクトルの組み合わせを探す）。アプリ本体からは使っていない。

キャラの絵は `public/art/` にある（Higgsfield の nano_banana_2 で生成。表紙は 2:3、背景は 9:16、どちらも 2k で作り、下のサイズに縮めて書き出す）。表紙 `<plotId>-cover.webp`（900×1342）、会話画面の背景 `<plotId>-bg.webp`（幅720）、アイコン用の顔 `face-<名前>.webp`（192×192）。パスは `characters.ts` の `cover` / `backdrop` / `face` に書く。

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
- 有料化、ユーザーによるキャラ作成、漫画化
