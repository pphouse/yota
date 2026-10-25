import { z } from "zod";
import { MIN_AGE, ageFrom, isValidBirth } from "@/lib/age";
import { createSession, getSession } from "@/lib/session";
import { logEvent } from "@/lib/store";
import { getUsage } from "@/lib/usage";

export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ session: null });
  const usage = await getUsage(session.id, session.isMinor);
  return Response.json({ session: { isMinor: session.isMinor }, usage });
}

const Body = z.object({ birthYear: z.number().int(), birthMonth: z.number().int() });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !isValidBirth(parsed.data.birthYear, parsed.data.birthMonth)) {
    return Response.json({ error: "生まれた年と月を正しく入力してください" }, { status: 400 });
  }
  const { birthYear, birthMonth } = parsed.data;
  if (ageFrom(birthYear, birthMonth) < MIN_AGE) {
    return Response.json({ error: `このサービスは${MIN_AGE}歳以上の方が対象です` }, { status: 403 });
  }
  const session = await createSession(birthYear, birthMonth);
  await logEvent(session.id, "session_start", { isMinor: session.isMinor });
  return Response.json({ session: { isMinor: session.isMinor } });
}
