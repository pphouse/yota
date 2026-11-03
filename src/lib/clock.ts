/**
 * 遊んでいる人の端末の時刻。会話の画面の色（深夜・朝・夕方・夜）と、キャラの返事（深夜なら「まだ起きてたの」など）に使う。
 */
export type Clock = { hour: number; minute: number; weekday: number };

export function nowClock(d = new Date()): Clock {
  return { hour: d.getHours(), minute: d.getMinutes(), weekday: d.getDay() };
}

export type DayPart = "midnight" | "morning" | "day" | "evening" | "night";

export function dayPart(hour: number): DayPart {
  if (hour < 5) return "midnight";
  if (hour < 9) return "morning";
  if (hour < 16) return "day";
  if (hour < 19) return "evening";
  return "night";
}

export const DAY_PART_LABEL: Record<DayPart, string> = { midnight: "深夜", morning: "朝", day: "昼", evening: "夕方", night: "夜" };
const WEEKDAY = ["日", "月", "火", "水", "木", "金", "土"];

/** 会話の背景に重ねる色（昼は重ねない） */
export function timeTint(hour: number): string | null {
  switch (dayPart(hour)) {
    case "midnight":
      return "linear-gradient(180deg, rgba(28,36,110,0.42), rgba(8,10,36,0.38))";
    case "morning":
      return "linear-gradient(180deg, rgba(255,198,160,0.2), rgba(255,236,210,0.06))";
    case "evening":
      return "linear-gradient(180deg, rgba(255,140,80,0.24), rgba(120,56,140,0.14))";
    case "night":
      return "linear-gradient(180deg, rgba(40,48,120,0.24), rgba(10,10,30,0.18))";
    default:
      return null;
  }
}

/** プロンプトに入れる、いまの時間の説明 */
export function describeClock(c: Clock): string {
  const part = DAY_PART_LABEL[dayPart(c.hour)];
  return `${WEEKDAY[c.weekday]}曜日の${part}${c.hour}時${String(c.minute).padStart(2, "0")}分`;
}
