// アプリと同じ処理（プロンプト・返答・安全判定・話者の解決・返事の候補）で、1往復ずつ会話するための道具。
// 評価役のエージェントが、ユーザーとしてこのコマンドで話す。リポジトリのどこからでも実行できる。
//   new <会話ファイル> <plotId> <self|watch> [名前]  … 会話を始め、オープニングと最初の候補を出す（名前は self で使う）
//   say <会話ファイル> "<送る文>"                     … 1往復進め、返答と次の候補を出す
//   show <会話ファイル>                               … これまでの会話を表示する
//
// どのモデル（とベクトル）で返すかは、会話ファイルの1つ上のフォルダの arms.json で決める。評価役には見せない。
// 会話ファイルを置いたフォルダの名前がアームの名前なら、そのアームを使う（results/r1/A/mio-sleepless-ceo.json → A）。
//   { "arms": { "A": { "baseUrl": "http://localhost:8000/v1", "model": "base+dere=1@16" },
//               "B": { "baseUrl": "https://api.cerebras.ai/v1", "model": "qwen-3.8-27b", "apiKeyEnv": "OPENAI_API_KEY", "effort": "medium" } },
//     "suggest": { "baseUrl": "https://api.cerebras.ai/v1", "model": "qwen-3.8-27b", "apiKeyEnv": "OPENAI_API_KEY", "effort": "low" },
//     "assign": { "mio-sleepless-ceo": "A" }, "default": "B" }
// アームに "byPlot": { "sleepy-prince": "base+sleepy=0.5@20" } を書くと、その作品だけ model を差し替える（キャラ別のベクトル）。
// 返事の候補は suggest のモデルで作る（キャラの返答の違いだけを比べるため。省くと、その会話のモデルで作る）。
// プロンプトは src/lib をそのまま使う。LIB にスナップショットのフォルダを指定すると、そちらを使う。
// MINOR=1 を付けると、18歳未満のユーザーとして話す（表現をおだやかにするプロンプトになる）。
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type Characters = typeof import("../../src/lib/characters");
type Prompt = typeof import("../../src/lib/prompt");
type Story = typeof import("../../src/lib/story");
type Safety = typeof import("../../src/lib/safety");
type Suggest = typeof import("../../src/lib/suggest");
type Llm = typeof import("../../src/lib/llm/index");
type Japanese = typeof import("../../src/lib/japanese");
type Username = typeof import("../../src/lib/username");

type Endpoint = { baseUrl: string; model: string; apiKeyEnv?: string | null; effort?: string | null; byPlot?: Record<string, string> };
type Arms = { arms: Record<string, Endpoint>; suggest?: Endpoint; assign?: Record<string, string>; default?: string };
type Msg = { role: "user" | "assistant"; content: string; flagged?: boolean };
type Timing = { firstMs: number; totalMs: number; chars: number };
type Convo = { lib: string; plotId: string; view: "self" | "watch"; name: string; arm: string; messages: Msg[]; suggestions: string[]; timings: Timing[] };

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

// .env.local があれば読む（本番と同じ Cerebras のキーなど。キーは表示しない）
const envFile = resolve(ROOT, ".env.local");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
}

const [cmd, file, ...rest] = process.argv.slice(2);
if (!cmd || !file) {
  console.error('使い方: talk.ts new <file> <plotId> <self|watch> [名前] | say <file> "<文>" | show <file>');
  process.exit(2);
}
const path = resolve(file);
const convoName = path.split("/").pop()!.replace(/\.json$/, "");
const isMinor = process.env.MINOR === "1";

async function load(lib: string) {
  return {
    characters: (await import(`${lib}/characters.ts`)) as Characters,
    prompt: (await import(`${lib}/prompt.ts`)) as Prompt,
    story: (await import(`${lib}/story.ts`)) as Story,
    safety: (await import(`${lib}/safety.ts`)) as Safety,
    suggest: (await import(`${lib}/suggest.ts`)) as Suggest,
    llm: (await import(`${lib}/llm/index.ts`)) as Llm,
    japanese: (await import(`${lib}/japanese.ts`)) as Japanese,
    username: (await import(`${lib}/username.ts`)) as Username,
  };
}

function readArms(): Arms {
  const p = resolve(dirname(path), "../arms.json");
  if (!existsSync(p)) throw new Error(`arms.json がありません: ${p}`);
  return JSON.parse(readFileSync(p, "utf8")) as Arms;
}

/** アームの設定から、アプリと同じ文章AIの差し替え層を作る */
function providerFor(llm: Llm, ep: Endpoint, brief = false, plotId = "") {
  const key = ep.apiKeyEnv ? process.env[ep.apiKeyEnv] : "local";
  if (!key) throw new Error(`環境変数 ${ep.apiKeyEnv} がありません`);
  return llm.createProvider({
    LLM_PROVIDER: "openai",
    OPENAI_API_KEY: key,
    OPENAI_BASE_URL: ep.baseUrl,
    OPENAI_MODEL_FAST: ep.byPlot?.[plotId] ?? ep.model,
    ...(ep.effort ? { OPENAI_REASONING_EFFORT: ep.effort, OPENAI_SUGGEST_REASONING_EFFORT: brief ? ep.effort : undefined } : {}),
  });
}

function render(text: string, names: string[], toBeats: Story["toBeats"]): string {
  return toBeats(text, names)
    .map((b) =>
      b.kind === "narration"
        ? `  （地の文）${b.text}`
        : b.kind === "scene"
          ? `  （情景）${b.text}`
          : b.kind === "note"
            ? `  （補足）${b.text}`
            : `  ${b.speaker === undefined ? "（名前なしの吹き出し）" : names[b.speaker]}：${b.text}`,
    )
    .join("\n");
}

// 混み合い（429）やサーバーの一時的な失敗は、少し待ってやり直す
async function retry<T>(fn: () => Promise<T>): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (e) {
      const status = (e as { status?: number })?.status ?? 0;
      if (i >= 4 || !(status === 429 || status >= 500)) throw e;
      await new Promise((r) => setTimeout(r, 2000 * 2 ** i));
    }
  }
}

function printSuggestions(s: string[]) {
  console.log(s.length ? `\n【返事の候補ボタン】\n${s.map((x, i) => `  ${i + 1}. ${x}`).join("\n")}` : "\n【返事の候補ボタン】（出なかった）");
}

if (cmd === "new") {
  const [plotId, view, name = ""] = rest as [string, "self" | "watch", string?];
  const lib = process.env.LIB ?? resolve(ROOT, "src/lib");
  const m = await load(lib);
  const plot = m.characters.getPlot(plotId);
  if (!plot) throw new Error(`作品が見つかりません: ${plotId}`);
  if (!plot.viewpoints.includes(view)) throw new Error(`この作品で選べる視点: ${plot.viewpoints.join(", ")}`);
  const arms = readArms();
  const folder = dirname(path).split("/").pop()!;
  const arm = arms.assign?.[convoName] ?? (arms.arms[folder] ? folder : arms.default);
  if (!arm || !arms.arms[arm]) throw new Error(`arms.json に「${convoName}」の割り当てがありません`);
  const opening = view === "self" ? m.username.nameInNarration(plot.opening.self!, name) : plot.opening.watch!;
  const c: Convo = { lib, plotId, view, name, arm, messages: [{ role: "assistant", content: opening }], suggestions: plot.starterReplies[view] ?? [], timings: [] };
  writeFileSync(path, JSON.stringify(c, null, 1));
  const names = plot.personas.map(m.characters.callName);
  console.log(`『${plot.title}』（${view === "self" ? "あなたが物語にいる" : "ふたりを見守る"}）`);
  console.log(`あらすじ：${plot.catchphrase}`);
  if (view === "self" && plot.role) console.log(`あなたの役：${plot.role}`);
  console.log(`登場人物：${plot.personas.map((p) => `${p.name}（${p.age}歳）`).join("、")}`);
  console.log(`\n【プロローグ】\n  ${plot.prologue ?? plot.setting}`);
  console.log(`\n【オープニング】\n${render(c.messages[0].content, names, m.story.toBeats)}`);
  printSuggestions(c.suggestions);
} else if (cmd === "say") {
  if (!existsSync(path)) throw new Error(`会話ファイルがありません: ${path}`);
  const c = JSON.parse(readFileSync(path, "utf8")) as Convo;
  const m = await load(c.lib);
  const plot = m.characters.getPlot(c.plotId)!;
  const names = plot.personas.map(m.characters.callName);
  const text = rest.join(" ").trim();
  if (!text) throw new Error("送る文が空です");
  const verdict = m.safety.checkText(text);
  if (verdict.care) console.log(`（アプリの表示）${m.safety.CARE_NOTICE}`);
  if (!verdict.ok) {
    console.log(`（アプリの表示・送信されなかった）${m.safety.BLOCKED_INPUT_MESSAGE}`);
    process.exit(0);
  }
  c.messages.push({ role: "user", content: text });
  const arms = readArms();
  const provider = providerFor(m.llm, arms.arms[c.arm], false, c.plotId);
  const userTurns = c.messages.filter((x) => x.role === "user").length;
  const system = m.prompt.buildSystemPrompt({ plot, viewpoint: c.view, isMinor, summary: "", userTurns, userName: c.name });
  const history = m.prompt.toApiMessages(c.messages.filter((x) => !x.flagged || x.role === "user").map(({ role, content }) => ({ role, content })));
  let t0 = performance.now();
  let first = 0;
  let out = "";
  let flagged = false;
  await retry(async () => {
    t0 = performance.now();
    first = 0;
    out = "";
    flagged = false;
    for await (const chunk of provider.stream({ system, messages: history, tier: "fast", purpose: "chat" })) {
      if (!first) first = performance.now() - t0;
      out += chunk;
      if (!m.safety.checkText(out).ok) {
        flagged = true;
        break;
      }
      if (m.japanese.hasForeignText(out)) break;
    }
  });
  // アプリと同じく、日本語以外が混ざったり空だったりしたら1回だけ作り直す（画面では、違うところから打ち直される）
  let rewritten = false;
  if (!flagged && (m.japanese.hasForeignText(out) || !out.trim())) {
    rewritten = true;
    out = await retry(() => m.llm.generateText(provider, { system, messages: history, tier: "fast", purpose: "chat" }));
    if (m.japanese.hasForeignText(out)) out = m.japanese.stripForeignScripts(out);
    if (!m.safety.checkText(out).ok) flagged = true;
  }
  const total = performance.now() - t0;
  const reply = flagged ? m.safety.BLOCKED_OUTPUT_TEXT : out.trim();
  c.messages.push({ role: "assistant", content: reply || "（返答が空でした。アプリでは「再生成してください」と出る）", flagged });
  c.timings.push({ firstMs: Math.round(first), totalMs: Math.round(total), chars: reply.length });
  console.log(`【${names.join("・")}の返答】${rewritten ? "（画面では途中で一度、打ち直された）" : ""}`);
  console.log(render(reply, names, m.story.toBeats) || "  （返答が空でした）");
  const stored = c.messages.map((x, i) => ({ id: `m${i}`, seq: i, role: x.role, content: x.content, flagged: !!x.flagged }));
  const previous = c.suggestions;
  const suggestProvider = arms.suggest ? providerFor(m.llm, arms.suggest, true) : provider;
  c.suggestions = flagged
    ? []
    : await retry(() => m.suggest.suggestReplies({ plot, viewpoint: c.view, isMinor, summary: "", userName: c.name, messages: stored, previous, provider: suggestProvider }));
  printSuggestions(c.suggestions);
  writeFileSync(path, JSON.stringify(c, null, 1));
} else if (cmd === "show") {
  const c = JSON.parse(readFileSync(path, "utf8")) as Convo;
  const m = await load(c.lib);
  const plot = m.characters.getPlot(c.plotId)!;
  const names = plot.personas.map(m.characters.callName);
  console.log(`『${plot.title}』（${c.view}）`);
  for (const x of c.messages) console.log(x.role === "user" ? `\n▶ あなた：${x.content}` : `\n${render(x.content, names, m.story.toBeats)}`);
}
