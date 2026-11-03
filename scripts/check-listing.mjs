// App Store の掲載情報（docs/app-store-listing.md）が、文字数の上限に収まっているか確かめる
import { readFileSync } from "node:fs";
const md = readFileSync(new URL("../docs/app-store-listing.md", import.meta.url), "utf8");
const section = (title) => {
  const start = md.indexOf(`## ${title}`);
  const body = md.slice(md.indexOf("\n", start) + 1);
  const end = body.search(/\n## /);
  return (end < 0 ? body : body.slice(0, end)).trim();
};
const len = (s) => Array.from(s).length;
const checks = [
  ["サブタイトル", section("サブタイトル（30字まで）"), 30],
  ["プロモーションテキスト", section("プロモーションテキスト（170字まで。審査なしで書きかえられる）"), 170],
  ["説明", section("説明（4000字まで）"), 4000],
  ["キーワード", section("キーワード（100字まで、読点ではなく半角カンマで区切る）"), 100],
];
const names = section("名前（30字まで）").split("\n").filter((l) => /^\d+\. /.test(l)).map((l) => l.replace(/^\d+\. /, ""));
names.forEach((n, i) => checks.push([`名前${i + 1}`, n, 30]));
let ok = true;
for (const [label, text, max] of checks) {
  const n = len(text);
  if (n > max) ok = false;
  console.log(`${n > max ? "×" : "○"} ${label}：${n} / ${max}`);
}
process.exit(ok ? 0 : 1);
