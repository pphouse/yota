"""評価の集計（標準ライブラリだけで動く）。

ラウンドのフォルダは次の形:
  results/<ラウンド>/arms.json            … アームの設定（talk.ts と同じ）
  results/<ラウンド>/<アーム>/<会話>.json … 会話ファイル（フォルダ名がアーム名）
  results/<ラウンド>/reports/<アーム>-<人物像>.md … ユーザー役のレポート（最後に ```json の採点）
  results/<ラウンド>/pairs/<X>-vs-<Y>/    … 比べる係に渡す組と、その結果

使い方:
  python score.py tally results/r1               # アームごとの平均点・続けたい・閉じた割合・スクショ数・速さ
  python score.py pairs results/r1 A B [seed]    # 同じ人物像×作品の会話を、どちらがどちらか分からない形で組にする（seed で並び順を変える）
  python score.py wins  results/r1 A B           # 比べる係の結果から、勝率を出す（位置の偏りも見る）
"""

from __future__ import annotations

import json
import random
import re
import statistics
import sys
from pathlib import Path

AXES = ["噛み合い", "キャラらしさ", "日本語", "返しやすさ", "ときめき", "展開", "健全さ"]


def arm_dirs(root: Path) -> dict[str, Path]:
    arms = json.loads((root / "arms.json").read_text(encoding="utf-8"))["arms"]
    return {a: root / a for a in arms if (root / a).is_dir()}


def report_blocks(root: Path) -> list[tuple[str, dict]]:
    """レポートの最後の ```json ブロックを読む。戻り値は (ファイル名, 中身)。"""
    out = []
    for md in sorted((root / "reports").glob("*.md")):
        blocks = re.findall(r"```json\s*(\{.*?\})\s*```", md.read_text(encoding="utf-8"), flags=re.S)
        if not blocks:
            print(f"注意: {md.name} に採点の JSON がありません")
            continue
        try:
            out.append((md.stem, json.loads(blocks[-1])))
        except json.JSONDecodeError as e:
            print(f"注意: {md.name} の JSON が読めません: {e}")
    return out


def tally(root: Path):
    dirs = arm_dirs(root)
    rows: dict[str, list[dict]] = {a: [] for a in dirs}
    for stem, block in report_blocks(root):
        arm = stem.split("-")[0]  # レポートの名前は <アーム>-<人物像>.md
        if arm not in rows:
            print(f"注意: reports/{stem}.md の名前からアームが分かりません（<アーム>-<人物像>.md にする）")
            continue
        rows[arm].extend(block.get("conversations", []))
    lines = ["| アーム | 会話数 | " + " | ".join(AXES) + " | 7項目の平均 | 続けたい | 閉じた割合 | スクショ/会話 | 最初の文字(秒) | 字/秒 |", "|" + "---|" * (len(AXES) + 8)]
    for arm, convs in rows.items():
        timings = [t for f in dirs[arm].glob("*.json") for t in json.loads(f.read_text(encoding="utf-8")).get("timings", [])]
        first = statistics.mean(t["firstMs"] for t in timings) / 1000 if timings else float("nan")
        cps = statistics.mean(t["chars"] / max(t["totalMs"] / 1000, 0.001) for t in timings) if timings else float("nan")
        if not convs:
            lines.append(f"| {arm} | 0 |" + " |" * (len(AXES) + 5) + f" {first:.1f} | {cps:.0f} |")
            continue
        means = [statistics.mean(c["scores"][a] for c in convs if a in c.get("scores", {})) for a in AXES]
        cont = statistics.mean(c.get("続けたい", 0) for c in convs)
        quit_rate = sum(c.get("閉じた往復") is not None for c in convs) / len(convs)
        shots = statistics.mean(len(c.get("スクショ") or []) for c in convs)
        lines.append(f"| {arm} | {len(convs)} | " + " | ".join(f"{m:.2f}" for m in means) + f" | {statistics.mean(means):.2f} | {cont:.2f} | {quit_rate:.0%} | {shots:.2f} | {first:.1f} | {cps:.0f} |")
    text = "\n".join(lines)
    (root / "summary.md").write_text(text + "\n", encoding="utf-8")
    print(text)


def transcript(conv: dict) -> str:
    out = []
    for m in conv["messages"]:
        out.append(f"▶ ユーザー：{m['content']}" if m["role"] == "user" else m["content"])
    return "\n\n".join(out)


def pairs(root: Path, x: str, y: str, seed: str = "0"):
    rng = random.Random(int(seed))
    out = root / "pairs" / f"{x}-vs-{y}"
    out.mkdir(parents=True, exist_ok=True)
    key = {}
    names = sorted({f.stem for f in (root / x).glob("*.json")} & {f.stem for f in (root / y).glob("*.json")})
    for i, name in enumerate(names, 1):
        a = json.loads((root / x / f"{name}.json").read_text(encoding="utf-8"))
        b = json.loads((root / y / f"{name}.json").read_text(encoding="utf-8"))
        first, second = ((x, a), (y, b)) if rng.random() < 0.5 else ((y, b), (x, a))
        pid = f"p{i:02d}"
        persona = name.split("-")[0]
        header = f"# {pid}\n\n人物像：{persona}（steering/eval/personas.md を参照）／作品：{a['plotId']}（{a['view']}）\n"
        (out / f"{pid}.md").write_text(f"{header}\n## 会話1\n\n{transcript(first[1])}\n\n## 会話2\n\n{transcript(second[1])}\n", encoding="utf-8")
        key[pid] = {"1": first[0], "2": second[0], "conversation": name}
    (out / "key.json").write_text(json.dumps(key, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{len(names)} 組を {out} に作った（key.json は比べる係に見せない）")


def wins(root: Path, x: str, y: str):
    d = root / "pairs" / f"{x}-vs-{y}"
    key = json.loads((d / "key.json").read_text(encoding="utf-8"))
    judgments = [json.loads(line) for line in (d / "judgments.jsonl").read_text(encoding="utf-8").splitlines() if line.strip()]
    lines = [f"# {x} 対 {y}（{len(judgments)} 組）\n", f"| 観点 | {x} の勝ち | {y} の勝ち | 引き分け | {x} の勝率（引き分けは半分） |", "|---|---|---|---|---|"]
    for axis in ["総合", *AXES]:
        w = {x: 0, y: 0, "tie": 0}
        for j in judgments:
            v = str(j.get(axis, "tie"))
            w[key[j["pair"]][v] if v in ("1", "2") else "tie"] += 1
        n = sum(w.values()) or 1
        lines.append(f"| {axis} | {w[x]} | {w[y]} | {w['tie']} | {(w[x] + w['tie'] / 2) / n:.0%} |")
    first_pick = sum(str(j.get("総合")) == "1" for j in judgments) / max(len(judgments), 1)
    lines.append(f"\n位置の偏り：総合で「会話1」を選んだ割合 {first_pick:.0%}（50% から大きくずれていたら、順番を入れ替えてもう一度比べる）")
    text = "\n".join(lines)
    (d / "wins.md").write_text(text + "\n", encoding="utf-8")
    print(text)


if __name__ == "__main__":
    cmd, root, *rest = sys.argv[1:]
    {"tally": lambda: tally(Path(root)), "pairs": lambda: pairs(Path(root), *rest), "wins": lambda: wins(Path(root), *rest)}[cmd]()
