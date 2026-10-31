import { getSession } from "@/lib/session";
import { logEvent } from "@/lib/store";
import { countRecent, saveImage } from "@/lib/ugc";

/** 1日に登録できる画像の数と、1枚の大きさの上限（作る画面で 512px 四方に縮めてから送る） */
const IMAGES_PER_DAY = 30;
const MAX_BYTES = 600 * 1024;

/** 先頭のバイトで、画像の種類を確かめる（送られてきた content-type は信じない） */
function sniff(b: Uint8Array): string | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}

/** キャラの画像を登録する。本文は画像そのもの */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "年齢の確認が必要です" }, { status: 401 });
  if (session.isMinor) return Response.json({ error: "作品を作れるのは18歳以上の方です" }, { status: 403 });
  const data = new Uint8Array(await req.arrayBuffer());
  if (data.length === 0 || data.length > MAX_BYTES) return Response.json({ error: "画像が大きすぎます" }, { status: 413 });
  const mime = sniff(data);
  if (!mime) return Response.json({ error: "画像の形式が対応していません（JPEG・PNG・WebP）" }, { status: 415 });
  if ((await countRecent(session.id, "ugc_image")) >= IMAGES_PER_DAY) {
    return Response.json({ error: "今日登録できる画像の数の上限に達しました" }, { status: 429 });
  }
  const url = await saveImage(session.id, data, mime);
  await logEvent(session.id, "ugc_image", { url });
  return Response.json({ url });
}
