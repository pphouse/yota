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
