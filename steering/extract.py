"""性格ベクトルを作る（persona vectors と同じ作り方）。

1. 性格を「出す」指示と「出さない」指示のそれぞれで、同じ質問に返答させる
2. （任意）採点役のAIで、ちゃんと性格が出た返答だけを残す
3. 返答の部分のトークンについて、各層の残差ストリームを平均する
4. 「出す」の平均 −「出さない」の平均 を、層ごとのベクトルとして保存する

使い方:
  python extract.py --model <HFのid> --traits dere,sycophancy --samples 2
  # 採点役を使う場合（OpenAI互換API）
  python extract.py --model <id> --traits dere --judge-url https://api.cerebras.ai/v1 --judge-model qwen-3.8-27b --judge-key-env CEREBRAS_API_KEY
"""

from __future__ import annotations

import argparse
import json
import os
import time
import urllib.request

import torch

from common import HERE, chat_prompt, generate, load_model, read_json, vectors_dir


def judge_scores(texts: list[tuple[str, str]], trait: dict, url: str, model: str, key: str) -> list[float]:
    """採点役のAIに、返答にその性格がどのくらい出ているかを0〜100で付けさせる。"""
    scores = []
    for question, answer in texts:
        prompt = (
            f"次の返答に「{trait['label']}」の性格がどのくらい表れているかを0〜100の整数で答えてください。"
            f"100は「{trait['positive']}」に完全に当てはまる、0は「{trait['negative']}」に完全に当てはまる、という意味です。"
            f"数字だけを答えてください。\n\n相手の発言：{question}\n返答：{answer}"
        )
        body = json.dumps({"model": model, "messages": [{"role": "user", "content": prompt}], "max_completion_tokens": 4000}).encode()
        req = urllib.request.Request(f"{url}/chat/completions", data=body, headers={"content-type": "application/json", "authorization": f"Bearer {key}"})
        try:
            with urllib.request.urlopen(req, timeout=120) as res:
                text = json.load(res)["choices"][0]["message"]["content"]
            scores.append(float(next(t for t in text.replace("。", " ").split() if t.strip().isdigit())))
        except Exception as e:  # 採点に失敗した返答は、どちらにも使わない
            print(f"  採点に失敗: {e}")
            scores.append(float("nan"))
    return scores


@torch.no_grad()
def response_means(model, tok, rows: list[tuple[str, str]], batch_size: int = 8) -> torch.Tensor:
    """(プロンプト, 返答) ごとに、返答部分のトークンで各層の残差を平均する。戻り値は [件数, 層, 次元]。"""
    out = []
    for i in range(0, len(rows), batch_size):
        batch = rows[i : i + batch_size]
        texts = [p + r for p, r in batch]
        enc = tok(texts, return_tensors="pt", padding=True, add_special_tokens=False).to(model.device)
        # 左に詰めているので、返答は末尾の resp_len トークン
        resp_lens = [len(tok(p + r, add_special_tokens=False)["input_ids"]) - len(tok(p, add_special_tokens=False)["input_ids"]) for p, r in batch]
        hs = model(**enc, output_hidden_states=True).hidden_states  # 埋め込み + 各層の出力
        stacked = torch.stack(hs[1:], dim=1)  # [B, 層, T, 次元]
        for b, n in enumerate(resp_lens):
            n = max(n, 1)
            out.append(stacked[b, :, -n:, :].float().mean(dim=1).cpu())
    return torch.stack(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True)
    ap.add_argument("--traits", required=True, help="traits.json の名前をカンマ区切りで")
    ap.add_argument("--train", type=int, default=30, help="ベクトル作りに使う質問の数（残りは sweep.py の確認用）")
    ap.add_argument("--samples", type=int, default=2, help="1つの質問あたりの返答の数")
    ap.add_argument("--max-new-tokens", type=int, default=200)
    ap.add_argument("--batch-size", type=int, default=16)
    ap.add_argument("--judge-url")
    ap.add_argument("--judge-model")
    ap.add_argument("--judge-key-env", default="JUDGE_API_KEY")
    ap.add_argument("--keep-pos", type=float, default=60, help="採点役を使うとき、これ以上の「出す」返答だけ使う")
    ap.add_argument("--keep-neg", type=float, default=40, help="採点役を使うとき、これ以下の「出さない」返答だけ使う")
    args = ap.parse_args()

    spec = read_json(HERE / "traits.json")
    model, tok = load_model(args.model)
    out_dir = vectors_dir(args.model)
    out_dir.mkdir(parents=True, exist_ok=True)
    questions = spec["questions"][: args.train]

    for name in args.traits.split(","):
        trait = spec["traits"][name]
        t0 = time.time()
        sides = {}
        for side in ("positive", "negative"):
            system = f"{spec['base']}\n{trait[side]}"
            prompts = [chat_prompt(tok, system, [{"role": "user", "content": q}]) for q in questions for _ in range(args.samples)]
            answers = generate(model, tok, prompts, max_new_tokens=args.max_new_tokens, batch_size=args.batch_size)
            qs = [q for q in questions for _ in range(args.samples)]
            sides[side] = {"prompts": prompts, "answers": answers, "questions": qs}
            print(f"[{name}] {side}: {len(answers)} 件の返答を作った（{time.time() - t0:.0f}秒）")

        if args.judge_url:
            key = os.environ.get(args.judge_key_env, "")
            for side in sides:
                sides[side]["scores"] = judge_scores(list(zip(sides[side]["questions"], sides[side]["answers"])), trait, args.judge_url, args.judge_model, key)

        def kept(side: str) -> list[int]:
            scores = sides[side].get("scores")
            if not scores:
                return list(range(len(sides[side]["answers"])))
            ok = (lambda s: s >= args.keep_pos) if side == "positive" else (lambda s: s <= args.keep_neg)
            return [i for i, s in enumerate(scores) if s == s and ok(s)]

        means = {}
        for side in sides:
            idx = kept(side)
            if len(idx) < 4:
                raise SystemExit(f"[{name}] {side} で使える返答が {len(idx)} 件しかありません。指示文か採点のしきい値を見直してください")
            rows = [(sides[side]["prompts"][i], sides[side]["answers"][i]) for i in idx]
            means[side] = response_means(model, tok, rows).mean(dim=0)  # [層, 次元]
            sides[side]["kept"] = idx

        vectors = means["positive"] - means["negative"]
        hidden_norm = means["negative"].norm(dim=-1)
        rel = (vectors.norm(dim=-1) / hidden_norm).tolist()
        n_layers = vectors.shape[0]
        # おすすめの層の初期値は中ほど（persona vectors でも中間の層がよく効く）。sweep.py で決め直す
        best = n_layers // 2
        torch.save(
            {
                "trait": name,
                "model": args.model,
                "vectors": vectors,
                "relative_norms": rel,
                "best_layer": best,
                "n_pos": len(sides["positive"]["kept"]),
                "n_neg": len(sides["negative"]["kept"]),
                "spec": {"base": spec["base"], **trait},
            },
            out_dir / f"{name}.pt",
        )
        with open(out_dir / f"{name}.samples.jsonl", "w", encoding="utf-8") as f:
            for side in sides:
                for i, a in enumerate(sides[side]["answers"]):
                    f.write(json.dumps({"side": side, "question": sides[side]["questions"][i], "answer": a, "score": (sides[side].get("scores") or [None] * (i + 1))[i], "kept": i in sides[side]["kept"]}, ensure_ascii=False) + "\n")
        print(f"[{name}] 保存した: {out_dir / (name + '.pt')}（{n_layers}層、使った返答 {len(sides['positive']['kept'])}/{len(sides['negative']['kept'])} 件、{time.time() - t0:.0f}秒）")
        print("  層ごとの大きさ（隠れ状態に対する比）:", " ".join(f"{i}:{r:.2f}" for i, r in enumerate(rel)))


if __name__ == "__main__":
    main()
