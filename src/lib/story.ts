/** 返答の文章を、地の文（*…*）と台詞などに分ける。画面と名場面カードで共用する。 */
export type StoryPart = { kind: "narration" | "speech"; text: string };

export function parseStory(text: string): StoryPart[] {
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
 * narration = 地の文、note = （…）で囲まれた補足。
 */
export type Beat =
  | { kind: "line"; text: string; speaker?: number; open?: boolean }
  | { kind: "narration"; text: string }
  | { kind: "note"; text: string };

const QUOTE = /([^\s「」（）()*。、！？]{1,12})?「([^」]*)(」|$)/g;

function speakerOf(prefix: string, names: string[]): number | undefined {
  const i = names.findIndex((n) => n === prefix || n.split(/[\s・]/).includes(prefix));
  return i >= 0 ? i : undefined;
}

/** 返答を、話者つきの台詞・地の文・補足に分ける。流している途中の閉じていない「も台詞として扱う。 */
export function toBeats(text: string, names: string[]): Beat[] {
  const solo = names.length === 1;
  const beats: Beat[] = [];
  const loose = (raw: string) => {
    for (const piece of raw.split("\n")) {
      const t = piece.trim();
      if (!t) continue;
      if (/^[（(]/.test(t)) beats.push({ kind: "note", text: t.replace(/^[（(]|[）)]$/g, "") });
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
      beats.push({ kind: "narration", text: part.text });
      return;
    }
    let src = part.text;
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
    for (const m of src.matchAll(QUOTE)) {
      const prefix = m[1];
      let speaker = prefix ? speakerOf(prefix, names) : undefined;
      loose(src.slice(last, m.index) + (prefix && speaker === undefined ? prefix : ""));
      if (speaker === undefined && solo) speaker = 0;
      const unclosed = m[3] === "";
      const body = m[2].trim();
      if (body || (unclosed && isLast)) beats.push({ kind: "line", text: body, speaker, open: unclosed && isLast });
      if (unclosed && !isLast) carry = { speaker };
      last = (m.index ?? 0) + m[0].length;
    }
    loose(src.slice(last));
  });
  return beats;
}

/** 名場面カードに載せる一節。台詞「」があればそれを優先する。 */
export function pickQuote(text: string, max = 90): string {
  // 「…」と、直前に付いた話者名（陽太「…」）をまとめて拾う
  const speeches = [...text.matchAll(/([^\s「」*。、]{1,8})?「[^」]{4,}」/g)].map((m) => m[0].trim());
  const candidate =
    speeches.sort((a, b) => b.length - a.length).find((s) => s.length <= max) ??
    parseStory(text)
      .map((p) => p.text)
      .join(" ");
  return candidate.length > max ? candidate.slice(0, max - 1) + "…" : candidate;
}
