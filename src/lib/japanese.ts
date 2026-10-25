/**
 * 返答に日本語以外の文字が混ざっていないかを調べる。
 * 文章AIによっては、ハングル・キリル文字・ベトナム語や、中国語の漢字（简体字の「灭」「调」など）がまれに混ざる。
 * 見つけたら、返答は作り直し、返事の候補は捨てる。
 */

// ハングル・キリル文字・タイ文字・アクセント付きのラテン文字（ベトナム語など）。× と ÷ は除く
const FOREIGN_SCRIPT = /[\u0400-\u04ff\u0e00-\u0e7f\u1100-\u11ff\u3130-\u318f\uac00-\ud7af\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u024f\u1e00-\u1eff]/;
// 小文字だけの英単語（eleven など）。OK・PC・CEO のような大文字の略語は許す
const LATIN_WORD = /[a-z]{3,}/;
const KANJI = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g;
// Shift_JIS では表せるが、日本語の会話ではまず使わず、中国語として混ざってくる字
const CHINESE_IN_JIS = new Set("挂條冰");
// Shift_JIS にないが、常用漢字に入っている字
const JOYO_OUTSIDE_JIS = new Set("剝頰塡噓");

let jisKanji: Set<string> | undefined;

/** Shift_JIS（CP932）で表せる漢字。日本語で使う漢字はほぼすべて入り、簡体字は入らない */
function japaneseKanji(): Set<string> {
  if (jisKanji) return jisKanji;
  const dec = new TextDecoder("shift_jis");
  const set = new Set<string>();
  for (let lead = 0x81; lead <= 0xfc; lead++) {
    if (lead > 0x9f && lead < 0xe0) continue;
    for (let trail = 0x40; trail <= 0xfc; trail++) {
      if (trail === 0x7f) continue;
      const ch = dec.decode(new Uint8Array([lead, trail]));
      if (ch.length === 1 && /[\u3400-\u9fff\uf900-\ufaff]/.test(ch)) set.add(ch);
    }
  }
  jisKanji = set;
  return set;
}

/** 日本語以外の文字や単語が混ざっているか */
export function hasForeignText(text: string): boolean {
  if (FOREIGN_SCRIPT.test(text) || LATIN_WORD.test(text)) return true;
  const jis = japaneseKanji();
  for (const ch of text.match(KANJI) ?? []) {
    if (CHINESE_IN_JIS.has(ch)) return true;
    if (!jis.has(ch) && !JOYO_OUTSIDE_JIS.has(ch)) return true;
  }
  return false;
}

/** 作り直しても混ざったときの最後の手当て。ハングル・キリル文字などの語と、小文字の英単語を取り除く（漢字はそのまま） */
export function stripForeignScripts(text: string): string {
  return text
    .replace(new RegExp(`(?:${FOREIGN_SCRIPT.source})+`, "g"), "")
    .replace(/[a-z]{3,}/g, "")
    .replace(/ {2,}/g, " ");
}
