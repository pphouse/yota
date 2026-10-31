/** 流入元（リンクの ?ref=）。英小文字・数字・ハイフン・下線の40文字まで。それ以外は記録しない */
export function normalizeRef(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const v = raw.trim().toLowerCase();
  return /^[a-z0-9_-]{1,40}$/.test(v) ? v : "";
}

const KEY = "yota_ref";

/**
 * 最初に開いたリンクの ?ref= を、この端末に覚えておく（あとで年齢確認をしたときにセッションに付ける）。
 * 新しく覚えたときだけ、その値を返す
 */
export function captureRef(search: string): string | null {
  const ref = normalizeRef(new URLSearchParams(search).get("ref"));
  if (!ref) return null;
  try {
    if (localStorage.getItem(KEY)) return null;
    localStorage.setItem(KEY, ref);
  } catch {
    // 保存できない環境（プライベートブラウズなど）では、このページを開いた記録だけ残す
  }
  return ref;
}

export function storedRef(): string {
  try {
    return normalizeRef(localStorage.getItem(KEY));
  } catch {
    return "";
  }
}
