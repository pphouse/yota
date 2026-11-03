/**
 * 返答の書式（画面・名場面カード・あらすじ・返事の候補で共用する）
 * - *…*：地の文（登場人物の動作）
 * - 行頭の >：情景
 * - 〈…〉：心の声（口に出さない本音。画面ではぼかして見せ、押すと読める）
 * - ~~…~~：言いかけてやめた言葉（打ち消し線を引いて薄くする）
 * - 行頭の ▼：山場の見出し（画面ではカットインの演出にする）
 */

/** 心の声（閉じていない〈 は、流している途中の心の声） */
export const INNER = /〈([^〈〉]*)(〉|$)/g;
/**
 * 心の声の括弧のゆれをそろえる。文章AIは〈〉の代わりに <…>・＜…＞・《…》 を使うことがある。
 * 流している途中で閉じていない括弧も、心の声の始まりとして扱う
 */
export function normalizeMarks(text: string): string {
  return text.replace(/[<＜《]([^<>＜＞《》〈〉\n]{1,80})[>＞》]/g, "〈$1〉").replace(/[<＜《]([^<>＜＞《》〈〉\n]*)$/, "〈$1");
}

/** 山場の見出しの行 */
export const TITLE_LINE = /^\s*[▼▽]\s*(.*)$/;

/**
 * 書式の印を外した文章にする（あらすじ・返事の候補・カードの一節に使う）。
 * 言いかけてやめた言葉は口に出していないので消す。心の声は、相手に聞こえていないので既定では消し、
 * あらすじでは（本音：…）として残す
 */
export function plainStory(text: string, opts: { inner?: "drop" | "keep" } = {}): string {
  return normalizeMarks(text)
    .split("\n")
    .map((l) => {
      const t = l.match(TITLE_LINE);
      return t ? (opts.inner === "keep" && t[1].trim() ? `（場面：${t[1].trim()}）` : "") : l;
    })
    .join("\n")
    .replace(/~~[^~]*(~~|$)/g, "")
    .replace(INNER, (_, body: string) => (opts.inner === "keep" && body.trim() ? `（本音：${body.trim()}）` : ""))
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** 返答の最初にある山場の見出し（なければ null）。流している途中は、行が終わってから返す */
export function titleOf(text: string, complete = true): string | null {
  const first = text.trimStart().split("\n")[0] ?? "";
  const m = first.match(TITLE_LINE);
  if (!m || !m[1].trim()) return null;
  if (!complete && !text.trimStart().includes("\n")) return null;
  return m[1].trim();
}

/** 返答の文章を、地の文（*…*）と台詞などに分ける。画面と名場面カードで共用する。 */
export type StoryPart = { kind: "narration" | "speech"; text: string };

export function parseStory(text: string): StoryPart[] {
  text = text.replaceAll("＊", "*");
  const parts: StoryPart[] = [];
  const re = /\*([^*]+)\*/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    push(parts, "speech", text.slice(last, m.index));
    push(parts, "narration", m[1]);
    last = (m.index ?? 0) + m[0].length;
  }
  // 閉じていない * は、流している途中の地の文として扱う
  const rest = text.slice(last);
  const open = rest.indexOf("*");
  if (open >= 0) {
    push(parts, "speech", rest.slice(0, open));
    push(parts, "narration", rest.slice(open + 1));
  } else {
    push(parts, "speech", rest);
  }
  return parts;
}

function push(parts: StoryPart[], kind: StoryPart["kind"], raw: string) {
  const text = raw.trim();
  if (text) parts.push({ kind, text });
}

/**
 * 会話画面での一区切り。
 * line = 誰かの台詞（speaker は personas の添字。分からなければ undefined）、
 * narration = 地の文（登場人物の動作・表情。吹き出しの中に斜体で見せる）、
 * scene = 情景（「>」で始まる行。場所の空気や周りの人の反応を、吹き出しの外に見せる）、
 * note = （…）で囲まれた補足。
 */
export type Beat =
  | { kind: "line"; text: string; speaker?: number; open?: boolean }
  | { kind: "narration"; text: string }
  | { kind: "scene"; text: string }
  | { kind: "note"; text: string }
  | { kind: "inner"; text: string; speaker?: number; open?: boolean }
  | { kind: "title"; text: string };

// 情景の行（> または ＞ で始まる）
// 「*> 情景*」のように * の内側に書かれることもある
const SCENE_LINE = /^\s*\*?\s*[>＞]\s?/;

const QUOTE = /([^\s「」（）()*。、！？]{1,12})?「([^」]*)(」|$)/g;

// 名前の異体字。文章AIが名前の字を変えて書いても（一條・髙槻など）、同じ人として扱う
const VARIANTS: Record<string, string> = { 條: "条", 髙: "高", 﨑: "崎", 嵜: "崎", 邊: "辺", 邉: "辺", 澤: "沢", 濱: "浜", 齋: "斎", 齊: "斉", 櫻: "桜", 瀨: "瀬", 冰: "氷" };
const normalizeName = (s: string) => Array.from(s, (c) => VARIANTS[c] ?? c).join("");

function speakerOf(prefix: string, names: string[]): number | undefined {
  const p = normalizeName(prefix);
  const i = names.findIndex((n) => {
    const name = normalizeName(n);
    return name === p || name.split(/[\s・]/).includes(p);
  });
  return i >= 0 ? i : undefined;
}

/** 名前の前に言葉がくっついたとき（そう言って一条「…」）。末尾が名前なら、その人と、前に残った言葉を返す */
function speakerAtEnd(prefix: string, names: string[]): { speaker: number; rest: string } | undefined {
  const p = normalizeName(prefix);
  let best: { speaker: number; rest: string; len: number } | undefined;
  names.forEach((n, i) => {
    for (const part of [normalizeName(n), ...normalizeName(n).split(/[\s・]/)]) {
      if (part && p.length > part.length && p.endsWith(part) && part.length > (best?.len ?? 0)) {
        best = { speaker: i, rest: prefix.slice(0, prefix.length - part.length), len: part.length };
      }
    }
  });
  return best && { speaker: best.speaker, rest: best.rest };
}

/**
 * ひとりの作品では、台詞が「」なしで書かれることが多い。文の途中の「…」（俺は「取れた」と…）は強調や引用なので、
 * 吹き出しを分けないよう『…』にする。行の頭・文の終わり・」・名前のあとの「は、台詞の始まりのまま残す。
 */
function softenInlineQuotes(src: string, names: string[]): string {
  return src.replace(/「([^「」\n]*)」/g, (whole, body: string, offset: number) => {
    const before = src.slice(0, offset);
    const line = before.slice(before.lastIndexOf("\n") + 1).trimEnd();
    if (!line || /[」。！？!?]$/.test(line)) return whole;
    const prefix = line.match(/[^\s「」（）()*。、！？]{1,12}$/)?.[0];
    if (prefix && speakerOf(prefix, names) !== undefined) return whole;
    return `『${body}』`;
  });
}

/** 台詞の中に入れ子になった「…」（久住「「ちゃんと言う」じゃ困る」）を『…』にする。吹き出しが割れないように */
function nestQuotes(text: string): string {
  let depth = 0;
  return Array.from(text, (c) => {
    if (c === "「") return depth++ === 0 ? c : "『";
    if (c === "」" && depth > 0) return --depth === 0 ? c : "』";
    return c;
  }).join("");
}

/** 返答を、話者つきの台詞・地の文・情景・補足に分ける。流している途中の閉じていない「も台詞として扱う。 */
export function toBeats(text: string, names: string[]): Beat[] {
  const beats: Beat[] = [];
  let rest: string[] = [];
  const flush = () => {
    if (rest.length) beats.push(...beatsOf(rest.join("\n"), names));
    rest = [];
  };
  for (const line of normalizeMarks(text).replaceAll("＊", "*").split("\n")) {
    const title = line.match(TITLE_LINE);
    if (title) {
      flush();
      if (title[1].trim()) beats.push({ kind: "title", text: title[1].replaceAll("*", "").trim() });
      continue;
    }
    if (!SCENE_LINE.test(line)) {
      rest.push(line);
      continue;
    }
    flush();
    const scene = line.replace(SCENE_LINE, "").replaceAll("*", "").trim();
    if (scene) beats.push({ kind: "scene", text: scene });
  }
  flush();
  return splitInner(beats, names);
}

/**
 * 区切りの中の心の声（〈…〉）を、別の区切りとして取り出す。台詞のあとなら、その人の心の声にする。
 * 「名前〈…〉」のように名前だけが残ったときは、その人の心の声として名前を消す
 */
function splitInner(beats: Beat[], names: string[]): Beat[] {
  const out: Beat[] = [];
  for (const b of beats) {
    if (b.kind === "title" || b.kind === "inner" || !b.text.includes("〈")) {
      out.push(b);
      continue;
    }
    const inners: { text: string; open: boolean }[] = [];
    let rest = "";
    let last = 0;
    for (const m of b.text.matchAll(INNER)) {
      rest += b.text.slice(last, m.index);
      inners.push({ text: m[1].replaceAll("*", "").trim(), open: m[2] === "" });
      last = (m.index ?? 0) + m[0].length;
    }
    rest = (rest + b.text.slice(last)).replace(/[ \t]*\n[ \t]*/g, "\n").trim();
    let speaker = b.kind === "line" ? b.speaker : undefined;
    const named = rest && b.kind !== "line" ? speakerOf(rest, names) : undefined;
    if (named !== undefined) {
      speaker = named;
      rest = "";
    }
    if (rest || (b.kind === "line" && b.open && !inners.length)) out.push({ ...b, text: rest });
    for (const inner of inners) if (inner.text || inner.open) out.push({ kind: "inner", text: inner.text, speaker, open: inner.open });
  }
  return out;
}

/** 情景の行を除いた部分を、台詞・地の文・補足に分ける */
function beatsOf(text: string, names: string[]): Beat[] {
  text = nestQuotes(text);
  const solo = names.length === 1;
  const beats: Beat[] = [];
  const loose = (raw: string) => {
    for (const piece of raw.split("\n")) {
      const t = piece.trim();
      if (!t) continue;
      if (SCENE_LINE.test(t)) beats.push({ kind: "scene", text: t.replace(SCENE_LINE, "") });
      else if (/^[（(]/.test(t)) beats.push({ kind: "note", text: t.replace(/^[（(]|[）)]$/g, "") });
      // 地の文の前に名前だけが置かれたとき（静*皿の縁を…*）は、名前だけの行を出さない
      else if (!solo && speakerOf(t, names) !== undefined) continue;
      else if (solo) beats.push({ kind: "line", text: t, speaker: 0 });
      else beats.push({ kind: "narration", text: t });
    }
  };
  const parts = parseStory(text);
  // 台詞の途中に *行動* が挟まったとき（透「……。*叩く* 寝ろ」）、続きを同じ人の台詞として扱う
  let carry: { speaker?: number } | null = null;
  parts.forEach((part, pi) => {
    const isLast = pi === parts.length - 1;
    if (part.kind === "narration") {
      if (SCENE_LINE.test(part.text)) beats.push({ kind: "scene", text: part.text.replace(SCENE_LINE, "") });
      else beats.push({ kind: "narration", text: part.text });
      return;
    }
    let src = solo ? softenInlineQuotes(part.text, names) : part.text;
    if (carry) {
      const close = src.indexOf("」");
      const open = src.indexOf("「");
      if (close >= 0 && (open < 0 || close < open)) {
        const body = src.slice(0, close).trim();
        if (body) beats.push({ kind: "line", text: body, speaker: carry.speaker, open: false });
        src = src.slice(close + 1);
      } else if (open < 0) {
        // まだ閉じていない（流している途中など）
        beats.push({ kind: "line", text: src.trim(), speaker: carry.speaker, open: isLast });
        return;
      }
      carry = null;
    }
    let last = 0;
    let pending = "";
    for (const m of src.matchAll(QUOTE)) {
      const prefix = m[1];
      let speaker = prefix ? speakerOf(prefix, names) : undefined;
      let before = src.slice(last, m.index);
      if (prefix && speaker === undefined && !solo) {
        const tail = speakerAtEnd(prefix, names);
        if (tail) {
          speaker = tail.speaker;
          before += tail.rest;
        } else {
          // 登場人物でない人（店長・元部下など）の台詞や、「シエルの「…」の語尾が」のような文は、
          // 名前なしの吹き出しにせず、続く文とつなげて地の文として見せる
          pending += before + m[0];
          last = (m.index ?? 0) + m[0].length;
          continue;
        }
      } else if (prefix && speaker === undefined) {
        before += prefix;
      }
      loose(pending + before);
      pending = "";
      if (speaker === undefined && solo) speaker = 0;
      const unclosed = m[3] === "";
      const body = m[2].trim();
      if (body || (unclosed && isLast)) beats.push({ kind: "line", text: body, speaker, open: unclosed && isLast });
      if (unclosed && !isLast) carry = { speaker };
      last = (m.index ?? 0) + m[0].length;
    }
    loose(pending + src.slice(last));
  });
  return beats;
}

/** 名場面カードに載せる一節。台詞「」があればそれを優先する。 */
export function pickQuote(text: string, max = 90): string {
  // 情景の行・心の声・言いかけた言葉・見出しは、名場面の一節にしない
  text = plainStory(text)
    .split("\n")
    .filter((l) => !SCENE_LINE.test(l))
    .join("\n");
  // 「…」と、直前に付いた話者名（陽太「…」）をまとめて拾う
  const speeches = [...text.matchAll(/([^\s「」*。、]{1,8})?「[^」]{4,}」/g)].map((m) => m[0].trim());
  const candidate =
    speeches.sort((a, b) => b.length - a.length).find((s) => s.length <= max) ??
    parseStory(text)
      .map((p) => p.text)
      .join(" ");
  return candidate.length > max ? candidate.slice(0, max - 1) + "…" : candidate;
}

/** 吹き出しの中身。台詞と、その人物の動作（地の文）を書かれた順に並べる */
export type BubbleItem =
  | { kind: "line"; text: string; open?: boolean }
  | { kind: "narration"; text: string }
  | { kind: "inner"; text: string; open?: boolean };

/** 画面に並べる単位。吹き出し（話者ごと）・情景・補足 */
export type Block =
  | { kind: "bubble"; speaker?: number; items: BubbleItem[] }
  | { kind: "scene"; text: string }
  | { kind: "note"; text: string }
  | { kind: "title"; text: string };

/**
 * 区切りを、画面に並べる単位にまとめる。
 * 地の文は、続く台詞の人物の吹き出しに入れる（最後に残った地の文は、直前の吹き出しに入れる）。
 * ひとりの作品では、台詞がなくても地の文だけの吹き出しにする。複数人の作品で、どの吹き出しにも入らない地の文は情景として見せる。
 */
export function toBlocks(beats: Beat[], solo: boolean): Block[] {
  const blocks: Block[] = [];
  let pending: BubbleItem[] = [];
  const flush = () => {
    if (!pending.length) return;
    const last = blocks.at(-1);
    if (last?.kind === "bubble") last.items.push(...pending);
    else if (solo) blocks.push({ kind: "bubble", speaker: 0, items: pending });
    else {
      // 誰の吹き出しにも入らない地の文は情景に。心の声は、話者の分からない吹き出しにする（地の文に混ぜない）
      const narration = pending.filter((p) => p.kind === "narration");
      const inner = pending.filter((p) => p.kind === "inner");
      if (narration.length) blocks.push({ kind: "scene", text: narration.map((p) => p.text).join(" ") });
      if (inner.length) blocks.push({ kind: "bubble", speaker: undefined, items: inner });
    }
    pending = [];
  };
  for (const b of beats) {
    if (b.kind === "narration") {
      pending.push({ kind: "narration", text: b.text });
      continue;
    }
    if (b.kind === "inner") {
      // 心の声は、直前の吹き出し（ふつうはその台詞を言った人）に入れる。まだ吹き出しがなければ、次の吹き出しに入れる
      const item: BubbleItem = { kind: "inner", text: b.text, open: b.open };
      const last = blocks.at(-1);
      if (last?.kind === "bubble" && !pending.length && (b.speaker === undefined || last.speaker === undefined || last.speaker === b.speaker)) last.items.push(item);
      else pending.push(item);
      continue;
    }
    if (b.kind === "title") {
      flush();
      blocks.push({ kind: "title", text: b.text });
      continue;
    }
    if (b.kind === "line") {
      const speaker = solo ? 0 : b.speaker;
      const item: BubbleItem = { kind: "line", text: b.text, open: b.open };
      const last = blocks.at(-1);
      if (last?.kind === "bubble" && speaker !== undefined && last.speaker === speaker) last.items.push(...pending, item);
      else blocks.push({ kind: "bubble", speaker, items: [...pending, item] });
      pending = [];
      continue;
    }
    flush();
    blocks.push({ kind: b.kind, text: b.text });
  }
  flush();
  return blocks;
}

/** 漫画のコマ風カードに載せるもの */
export type MangaPanels = {
  /** 1コマ目のナレーション（山場の見出し、なければ情景か地の文） */
  narration?: string;
  /** 2コマ目の吹き出し（いちばん印象に残る台詞） */
  line?: { text: string; speaker?: number };
  /** 3コマ目：心の声（あればこちらを優先）か、もう1つの台詞 */
  inner?: { text: string; speaker?: number };
  second?: { text: string; speaker?: number };
};

const clipText = (s: string, max: number) => (Array.from(s).length > max ? Array.from(s).slice(0, max - 1).join("") + "…" : s);
/** 言いかけてやめた言葉を外した台詞（カードには、言い直したあとの言葉だけを載せる） */
const spoken = (s: string) => s.replace(/~~[^~]*(~~|$)/g, "").replace(/\s{2,}/g, " ").trim();

export function mangaPanels(text: string, names: string[]): MangaPanels {
  const blocks = toBlocks(toBeats(text, names), names.length === 1);
  const out: MangaPanels = {};
  const lines: { text: string; speaker?: number }[] = [];
  let narration: string | undefined;
  for (const b of blocks) {
    if (b.kind === "title") out.narration ??= b.text;
    else if (b.kind === "scene") narration ??= b.text;
    else if (b.kind === "bubble") {
      for (const item of b.items) {
        if (item.kind === "narration") narration ??= spoken(item.text);
        else if (item.kind === "inner" && item.text) out.inner ??= { text: clipText(item.text, 40), speaker: b.speaker };
        else if (item.kind === "line" && spoken(item.text)) lines.push({ text: spoken(item.text), speaker: b.speaker });
      }
    }
  }
  if (!out.narration && narration) out.narration = clipText(narration, 30);
  // いちばん長い台詞（長すぎるものは避ける）を主役にし、もう1つを3コマ目の候補にする
  const ranked = [...lines].sort((a, b) => Array.from(b.text).length - Array.from(a.text).length);
  const main = ranked.find((l) => Array.from(l.text).length <= 48) ?? ranked[0];
  if (main) out.line = { text: clipText(main.text, 48), speaker: main.speaker };
  const other = lines.find((l) => l !== main);
  if (other) out.second = { text: clipText(other.text, 36), speaker: other.speaker };
  return out;
}
