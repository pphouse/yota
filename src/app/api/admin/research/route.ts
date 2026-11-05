import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import { listDatasets, RESEARCH_MAX_BYTES, ResearchData, saveDataset } from "@/lib/research";

/** 調査データの一覧 */
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  return Response.json({ items: await listDatasets() });
}

const Body = z.object({ title: z.string().trim().min(1).max(80), data: z.unknown() });

/** 調査データを上げる（{ title, data }。data は調査が書き出した JSON） */
export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const text = await req.text();
  if (new TextEncoder().encode(text).length > RESEARCH_MAX_BYTES) {
    return Response.json({ error: "ファイルが大きすぎます（4MBまで）。アイコンの画像を埋め込んだ JSON なら、画像なしで書き出してください" }, { status: 413 });
  }
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return Response.json({ error: "JSON として読めませんでした" }, { status: 400 });
  }
  const parsed = Body.safeParse(body);
  if (!parsed.success) return Response.json({ error: "題名を入れてください" }, { status: 400 });
  const data = ResearchData.safeParse(parsed.data.data);
  if (!data.success) return Response.json({ error: "調査データの形ではありません（accounts と、その中の posts が必要です）" }, { status: 400 });
  return Response.json({ item: await saveDataset(parsed.data.title, data.data) });
}
