import { z } from "zod";
import { MIN_AGE, ageFrom, isValidBirth } from "@/lib/age";
import { createSession, getSession, setSessionName } from "@/lib/session";
import { listPlayedPlots, logEvent } from "@/lib/store";
import { getUsage } from "@/lib/usage";
import { normalizeRef } from "@/lib/ref";
import { normalizeUserName, USER_NAME_MAX } from "@/lib/username";

const NAME_ERROR = `名前は1〜${USER_NAME_MAX}文字で入力してください`;

export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ session: null });
  const [usage, played] = await Promise.all([getUsage(session.id, session.isMinor), listPlayedPlots(session.id)]);
  return Response.json({ session: { isMinor: session.isMinor, name: session.name }, usage, played });
}

const Body = z.object({ birthYear: z.number().int(), birthMonth: z.number().int(), name: z.string().max(64), ref: z.string().max(64).optional() });

/** 年齢確認。生まれた年月と、物語の中で呼ばれる名前を受け取って、匿名のセッションを作る */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !isValidBirth(parsed.data.birthYear, parsed.data.birthMonth)) {
    return Response.json({ error: "生まれた年と月を正しく入力してください" }, { status: 400 });
  }
  const { birthYear, birthMonth } = parsed.data;
  const name = normalizeUserName(parsed.data.name);
  if (!name) return Response.json({ error: NAME_ERROR }, { status: 400 });
  if (ageFrom(birthYear, birthMonth) < MIN_AGE) {
    return Response.json({ error: `このサービスは${MIN_AGE}歳以上の方が対象です` }, { status: 403 });
  }
  const ref = normalizeRef(parsed.data.ref);
  const session = await createSession(birthYear, birthMonth, name, ref);
  await logEvent(session.id, "session_start", { isMinor: session.isMinor, ref });
  return Response.json({ session: { isMinor: session.isMinor, name: session.name } });
}

const NameBody = z.object({ name: z.string().max(64) });

/** 名前を変える（あとから決める・変える） */
export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "年齢の確認が必要です" }, { status: 401 });
  const parsed = NameBody.safeParse(await req.json().catch(() => null));
  const name = parsed.success ? normalizeUserName(parsed.data.name) : null;
  if (!name) return Response.json({ error: NAME_ERROR }, { status: 400 });
  await setSessionName(session.id, name);
  await logEvent(session.id, "name_set", { length: Array.from(name).length });
  return Response.json({ session: { isMinor: session.isMinor, name } });
}
