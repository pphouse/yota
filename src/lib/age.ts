/** 利用できる最低年齢。環境変数で変更できる。 */
export const MIN_AGE = Number(process.env.MIN_AGE ?? 13);
export const ADULT_AGE = 18;

/**
 * 生年月から満年齢を求める。日付は持たないため、誕生月のあいだは「まだ誕生日前」とみなし、
 * 実際より若く判定する（未成年の見逃しを避ける）。
 */
export function ageFrom(birthYear: number, birthMonth: number, now = new Date()): number {
  const { year, month } = jstYearMonth(now);
  return year - birthYear - (month <= birthMonth ? 1 : 0);
}

export function jstYearMonth(now: Date): { year: number; month: number } {
  const jst = new Date(now.getTime() + 9 * 3600 * 1000);
  return { year: jst.getUTCFullYear(), month: jst.getUTCMonth() + 1 };
}

export function jstDayKey(now: Date): string {
  return new Date(now.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

export function jstHour(now: Date): number {
  return new Date(now.getTime() + 9 * 3600 * 1000).getUTCHours();
}

export function isValidBirth(year: number, month: number, now = new Date()): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month)) return false;
  if (month < 1 || month > 12) return false;
  const { year: y } = jstYearMonth(now);
  return year >= y - 120 && year <= y;
}
