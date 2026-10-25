import { cookies } from "next/headers";
import { ADULT_AGE, ageFrom } from "./age";
import { query, run } from "./db";

export const SESSION_COOKIE = "yota_sid";

export type Session = {
  id: string;
  birthYear: number;
  birthMonth: number;
  age: number;
  isMinor: boolean;
  /** 物語の中で呼ばれる名前。まだ決めていなければ空 */
  name: string;
};

type Row = { id: string; birth_year: number; birth_month: number; name: string | null };

function toSession(row: Row): Session {
  const age = ageFrom(Number(row.birth_year), Number(row.birth_month));
  return {
    id: row.id,
    birthYear: Number(row.birth_year),
    birthMonth: Number(row.birth_month),
    age,
    isMinor: age < ADULT_AGE,
    name: row.name ?? "",
  };
}

export async function getSession(): Promise<Session | null> {
  const sid = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!sid) return null;
  const rows = await query<Row>("SELECT id, birth_year, birth_month, name FROM sessions WHERE id = ?", [sid]);
  return rows[0] ? toSession(rows[0]) : null;
}

export async function createSession(birthYear: number, birthMonth: number, name: string): Promise<Session> {
  const id = crypto.randomUUID();
  await run("INSERT INTO sessions (id, birth_year, birth_month, name, created_at) VALUES (?, ?, ?, ?, ?)", [
    id,
    birthYear,
    birthMonth,
    name,
    Date.now(),
  ]);
  (await cookies()).set(SESSION_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return toSession({ id, birth_year: birthYear, birth_month: birthMonth, name });
}

export async function setSessionName(id: string, name: string): Promise<void> {
  await run("UPDATE sessions SET name = ? WHERE id = ?", [name, id]);
}
