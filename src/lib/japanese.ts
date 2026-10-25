/**
 * 返答に日本語以外の文字が混ざっていないかを調べる。
 * 文章AIによっては、ハングル・キリル文字・アラビア文字・ベトナム語や、中国語の漢字（简体字の「灭」「调」など）がまれに混ざる。
 * 見つけたら、返答は作り直し、返事の候補は捨てる。
 * どの外国語が混ざるかは読めないので、日本語の文章で使う文字を並べ、それ以外はすべて外国語とみなす。
 */

// 日本語の文章で使う文字（漢字は下で別に調べる）。記号・絵文字は許す
const ALLOWED = new RegExp(
  [
    "[\\t\\n\\r\\u0020-\\u007e]", // ASCII（英単語は LATIN_WORD で別に調べる）
    "[\\u00a0-\\u00bf\\u00d7\\u00f7]", // ラテン1の記号と × ÷
    "[\\u2000-\\u206f\\u2100-\\u27bf]", // 句読点・矢印・数学記号・囲み数字・罫線・図形・☆♪♡ など
    "[\\u2e80-\\u2fdf\\u3000-\\u30ff\\u31f0-\\u31ff\\u3200-\\u33ff]", // 部首・和文の句読点・ひらがな・カタカナ・囲み文字
    "[\\u3400-\\u4dbf\\u4e00-\\u9fff\\uf900-\\ufaff]", // 漢字
    "[\\u200d\\ufe0f\\ufe30-\\ufe4f\\uff00-\\uffef]", // 絵文字をつなぐ字・異体字セレクタ・全角/半角形
    "\\p{Extended_Pictographic}|\\p{Emoji_Modifier}", // 絵文字
    "\\u{20b9f}", // 𠮟（常用漢字）
  ].join("|"),
  "u",
);
// 小文字を含む2文字以上の英単語（eleven・Han など）。OK・PC・CEO のような大文字だけの略語は許す
const LATIN_WORD = /[A-Za-z]*[a-z][A-Za-z]*/g;
const KANJI = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;
// Shift_JIS では表せるが、日本語の会話ではまず使わず、中国語として混ざってくる字と単語
const CHINESE_IN_JIS = new Set("挂條冰");
const CHINESE_WORDS = /立牌|胸口|掌心|挨礼|刻時計|一下子|怎麼|什麼/;
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
      if (ch.length === 1 && KANJI.test(ch)) set.add(ch);
    }
  }
  jisKanji = set;
  return set;
}

/** 1文字が、日本語の文章に出てきてよい文字か */
function isJapaneseChar(ch: string): boolean {
  if (!ALLOWED.test(ch)) return false;
  if (!KANJI.test(ch)) return true;
  if (CHINESE_IN_JIS.has(ch)) return false;
  return japaneseKanji().has(ch) || JOYO_OUTSIDE_JIS.has(ch);
}

const latinWords = (text: string) => (text.match(LATIN_WORD) ?? []).filter((w) => w.length >= 2);

/** 日本語以外の文字や単語が混ざっているか */
export function hasForeignText(text: string): boolean {
  if (latinWords(text).length > 0 || CHINESE_WORDS.test(text)) return true;
  for (const ch of text) if (!isJapaneseChar(ch)) return true;
  return false;
}

/** 作り直しても混ざったときの最後の手当て。日本語にない文字と英単語を取り除く */
export function stripForeignScripts(text: string): string {
  const withoutWords = text.replace(LATIN_WORD, (w) => (w.length >= 2 ? "" : w));
  return Array.from(withoutWords).filter(isJapaneseChar).join("").replace(/ {2,}/g, " ");
}
