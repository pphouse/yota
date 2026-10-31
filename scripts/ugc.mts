// ユーザーが作った作品の確認と承認（作者が自分の環境で実行する）。
//   本番のDBを見るとき： DATABASE_URL と DATABASE_AUTH_TOKEN（または TURSO_DATABASE_URL / TURSO_AUTH_TOKEN）を設定して
//   npm run ugc -- list               … 掲載の申請が来ている作品（--all ですべて）
//   npm run ugc -- show <id>          … 作品の中身を全部見る（承認の前に読む）
//   npm run ugc -- approve <id>       … 「みんなの作品」に載せる
//   npm run ugc -- decline <id>       … 載せない（リンクでは遊べるまま）
//   npm run ugc -- remove <id>        … 問題のある作品を止める（リンクでも開けなくなる）
//   npm run ugc -- restore <id>       … 止めた作品を、リンクで遊べる状態に戻す
import { getUgc, listUgc, setUgcStatus, type UgcStatus } from "../src/lib/ugc";
import { checkCreation } from "../src/lib/ugc-schema";
import { toInput } from "../src/lib/ugc-draft";
import { query } from "../src/lib/db";

const [cmd = "list", id] = process.argv.slice(2);
const base = process.env.SITE_URL ?? "https://yotachat.app";
const date = (t: number) => new Date(t).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });

if (cmd === "list") {
  const all = process.argv.includes("--all");
  const items = all
    ? (await query<{ id: string }>("SELECT id FROM user_plots ORDER BY updated_at DESC LIMIT 100")).map((r) => r.id)
    : (await listUgc({ status: "pending" }, 100)).map((e) => e.meta.id);
  if (!items.length) console.log(all ? "作品はまだありません" : "申請中の作品はありません");
  for (const itemId of items) {
    const e = await getUgc(itemId);
    if (!e) continue;
    const problems = checkCreation(toInput(e.plot));
    console.log(`${e.meta.id}  [${e.meta.status}]  『${e.plot.title}』 作：${e.meta.author}  ${date(e.meta.updatedAt)}${problems.length ? `  ⚠ ${problems.join(",")}` : ""}`);
    console.log(`    ${base}/u/${e.meta.id}`);
  }
} else if (cmd === "show" && id) {
  const e = await getUgc(id);
  if (!e) throw new Error(`作品が見つかりません: ${id}`);
  console.log(JSON.stringify({ meta: e.meta, plot: toInput(e.plot) }, null, 2));
} else if (id && ["approve", "decline", "remove", "restore"].includes(cmd)) {
  const e = await getUgc(id);
  if (!e) throw new Error(`作品が見つかりません: ${id}`);
  const next: UgcStatus = cmd === "approve" ? "public" : cmd === "remove" ? "removed" : "private";
  await setUgcStatus(id, next);
  console.log(`『${e.plot.title}』を ${e.meta.status} → ${next} にしました`);
} else {
  console.log("使い方: npm run ugc -- list [--all] | show <id> | approve <id> | decline <id> | remove <id> | restore <id>");
}
