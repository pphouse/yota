"""性格ベクトルを、どの層に・どの強さで足すとよいかを調べる。

確認用の質問（traits.json の後半）に、性格の指示を入れずに返答させ、ベクトルを足したときの変わり方を見る。
- 射影：返答の残差を、ベクトルの向きに射影した値。強さを上げるほど素直に増えれば、狙った性格が出ている
- 日本語の割合・2文字の種類の割合：下がったら崩れている（他の言語が混ざる、同じ言葉を繰り返す）
- 採点役（任意）：性格が出ているかを0〜100で採点

使い方:
  python sweep.py --model <id> --trait dere --layers 10,14,18,22 --coefs -2,-1,0,1,2
  python sweep.py --model <id> --trait dere --layers 14,18 --coefs 0,1,1.5 --set-best 18   # おすすめの層を記録する
"""

from __future__ import annotations

import argparse
import json
import os
import statistics
import time

import torch

from common import HERE, Steer, VectorStore, chat_prompt, distinct2, generate, japanese_ratio, load_model, read_json, steering, vectors_dir
from extract import judge_scores, response_means


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True)
    ap.add_argument("--trait", required=True)
    ap.add_argument("--layers", default="", help="カンマ区切り。省くと深さの30%〜70%を5か所")
    ap.add_argument("--coefs", default="-2,-1,0,1,2")
    ap.add_argument("--multi", action="store_true", help="指定した層すべてに同時に足す（1通りとして試す）")
    ap.add_argument("--train", type=int, default=30, help="extract.py と同じ値（これより後ろの質問で確かめる）")
    ap.add_argument("--limit", type=int, default=10, help="確かめる質問の数")
    ap.add_argument("--max-new-tokens", type=int, default=200)
    ap.add_argument("--batch-size", type=int, default=16)
    ap.add_argument("--judge-url")
    ap.add_argument("--judge-model")
    ap.add_argument("--judge-key-env", default="JUDGE_API_KEY")
    ap.add_argument("--set-best", type=int, help="この層を、ベクトルのおすすめの層として記録する")
    args = ap.parse_args()

    store_dir = vectors_dir(args.model)
    if args.set_best is not None:
        path = store_dir / f"{args.trait}.pt"
        data = torch.load(path, map_location="cpu")
        data["best_layer"] = args.set_best
        torch.save(data, path)
        print(f"{path} のおすすめの層を {args.set_best} にした")
        return

    spec = read_json(HERE / "traits.json")
    trait = spec["traits"][args.trait]
    model, tok = load_model(args.model)
    store = VectorStore(store_dir)
    data = store.get(args.trait)
    n_layers = data["vectors"].shape[0]
    layers = [int(x) for x in args.layers.split(",")] if args.layers else sorted({round(n_layers * f) for f in (0.3, 0.4, 0.5, 0.6, 0.7)})
    coefs = [float(x) for x in args.coefs.split(",")]
    questions = spec["questions"][args.train :][: args.limit]
    prompts = [chat_prompt(tok, spec["base"], [{"role": "user", "content": q}]) for q in questions]

    configs = [(layers, c) for c in coefs] if args.multi else [([layer], c) for layer in layers for c in coefs]
    run_dir = HERE / "runs" / f"sweep-{store_dir.name}-{args.trait}-{time.strftime('%m%d-%H%M')}"
    run_dir.mkdir(parents=True, exist_ok=True)
    results = []
    for ls, coef in configs:
        t0 = time.time()
        with steering(model, store, [Steer(args.trait, coef, ls)]):
            answers = generate(model, tok, prompts, max_new_tokens=args.max_new_tokens, batch_size=args.batch_size)
        # 射影は、ベクトルを足さずに返答を読み直して測る（足した分そのものを測らないように）
        measure = ls[len(ls) // 2]
        unit = data["vectors"][measure] / data["vectors"][measure].norm()
        means = response_means(model, tok, list(zip(prompts, answers)))
        proj = (means[:, measure, :] @ unit).tolist()
        row = {
            "layers": ls,
            "coef": coef,
            "projection": statistics.mean(proj),
            "japanese": statistics.mean(japanese_ratio(a) for a in answers),
            "distinct2": statistics.mean(distinct2(a) for a in answers),
            "chars": statistics.mean(len(a) for a in answers),
            "seconds": round(time.time() - t0, 1),
            "answers": [{"question": q, "answer": a} for q, a in zip(questions, answers)],
        }
        if args.judge_url:
            scores = judge_scores(list(zip(questions, answers)), trait, args.judge_url, args.judge_model, os.environ.get(args.judge_key_env, ""))
            ok = [s for s in scores if s == s]
            row["judge"] = statistics.mean(ok) if ok else None
        results.append(row)
        print(
            f"層 {','.join(map(str, ls)):>8}  強さ {coef:+.1f}  射影 {row['projection']:8.2f}  日本語 {row['japanese']:.2f}  "
            f"種類 {row['distinct2']:.2f}  {row['chars']:.0f}字" + (f"  採点 {row['judge']:.0f}" if row.get("judge") is not None else "") + f"  （{row['seconds']}秒）"
        )

    (run_dir / "results.json").write_text(json.dumps(results, ensure_ascii=False, indent=1), encoding="utf-8")
    lines = [f"# {args.trait}（{trait['label']}）の層と強さ\n", f"モデル: `{args.model}`\n", "| 層 | 強さ | 射影 | 日本語 | 種類 | 字数 | 採点 |", "|---|---|---|---|---|---|---|"]
    for r in results:
        lines.append(f"| {','.join(map(str, r['layers']))} | {r['coef']:+.1f} | {r['projection']:.2f} | {r['japanese']:.2f} | {r['distinct2']:.2f} | {r['chars']:.0f} | {r.get('judge', '') if r.get('judge') is None else round(r['judge'])} |")
    lines.append("\n## 返答の例（各設定の最初の3問）\n")
    for r in results:
        lines.append(f"### 層 {','.join(map(str, r['layers']))} ・強さ {r['coef']:+.1f}\n")
        for a in r["answers"][:3]:
            lines.append(f"- **{a['question']}** → {a['answer']}")
        lines.append("")
    (run_dir / "report.md").write_text("\n".join(lines), encoding="utf-8")
    print(f"\n結果: {run_dir / 'report.md'}")


if __name__ == "__main__":
    main()
