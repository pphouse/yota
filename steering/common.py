"""ステアリングの共通部品：モデルの読み込み、チャットの組み立て、残差ストリームにベクトルを足すフック。

persona vectors（Anthropic）と同じく、層の出力（残差ストリーム）に「性格の向き」を足して振る舞いを変える。
"""

from __future__ import annotations

import json
import re
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

HERE = Path(__file__).resolve().parent


def vectors_dir(model_name: str) -> Path:
    """ベクトルはモデルごとに別。vectors/<モデル名>/<性格>.pt に置く。"""
    return HERE / "vectors" / model_name.rstrip("/").split("/")[-1]


def load_model(name: str, dtype: str = "auto"):
    """モデルとトークナイザを読む。GPU があれば GPU、なければ CPU（動作確認用）に載せる。"""
    tok = AutoTokenizer.from_pretrained(name)
    tok.padding_side = "left"  # まとめて生成するとき、末尾をそろえる
    if tok.pad_token is None:
        tok.pad_token = tok.eos_token
    cuda = torch.cuda.is_available()
    torch_dtype = {"auto": torch.bfloat16 if cuda else torch.float32, "bf16": torch.bfloat16, "fp32": torch.float32}[dtype]
    model = AutoModelForCausalLM.from_pretrained(name, dtype=torch_dtype, device_map="auto" if cuda else None)
    model.eval()
    return model, tok


def decoder_layers(model) -> torch.nn.ModuleList:
    """デコーダの層の並び（Qwen・Llama・Gemma など、model.model.layers の形のモデル）。"""
    for path in ("model.layers", "model.language_model.layers", "transformer.h"):
        obj = model
        try:
            for attr in path.split("."):
                obj = getattr(obj, attr)
            return obj
        except AttributeError:
            continue
    raise ValueError("デコーダの層が見つかりません（対応していない構造のモデルです）")


def chat_prompt(tok, system: str | None, messages: list[dict]) -> str:
    """チャットの形にした文字列。Qwen3 系の「考える」モードは切る（ステアリングの効きを本文で見るため）。"""
    msgs = ([{"role": "system", "content": system}] if system else []) + messages
    try:
        return tok.apply_chat_template(msgs, tokenize=False, add_generation_prompt=True, enable_thinking=False)
    except Exception:
        # system を受け付けない書式では、最初のユーザーの発言の前に入れる
        sys_text = "\n\n".join(m["content"] for m in msgs if m["role"] == "system")
        rest = [dict(m) for m in msgs if m["role"] != "system"]
        if not sys_text:
            raise
        if rest and rest[0]["role"] == "user":
            rest[0]["content"] = f"{sys_text}\n\n{rest[0]['content']}"
        else:
            rest.insert(0, {"role": "user", "content": sys_text})
        return tok.apply_chat_template(rest, tokenize=False, add_generation_prompt=True, enable_thinking=False)


@dataclass
class Steer:
    """1本のベクトルを、どの層に、どの強さで足すか。"""

    trait: str
    coef: float
    layers: list[int]


def parse_steers(spec: str) -> list[Steer]:
    """「dere=1.2@16」「dere=0.8@12,16,20+sycophancy=-1@18」の形を読む。@ を省くとベクトルに記録したおすすめの層を使う。"""
    steers = []
    for part in filter(None, spec.split("+")):
        m = re.fullmatch(r"([\w-]+)=(-?[\d.]+)(?:@([\d,]+))?", part.strip())
        if not m:
            raise ValueError(f"ステアリングの指定が読めません: {part}（例: dere=1.2@16）")
        trait, coef, layers = m.group(1), float(m.group(2)), m.group(3)
        steers.append(Steer(trait, coef, [int(x) for x in layers.split(",")] if layers else []))
    return steers


class VectorStore:
    """vectors/<モデル名>/<性格>.pt を読み、使い回す。"""

    def __init__(self, root: Path):
        self.root = root
        self.cache: dict[str, dict] = {}

    def get(self, trait: str) -> dict:
        if trait not in self.cache:
            path = self.root / f"{trait}.pt"
            if not path.exists():
                raise FileNotFoundError(f"{path} がありません。先に extract.py で作ってください")
            self.cache[trait] = torch.load(path, map_location="cpu")
        return self.cache[trait]

    def available(self) -> list[str]:
        return sorted(p.stem for p in self.root.glob("*.pt"))


@contextmanager
def steering(model, store: VectorStore, steers: list[Steer] | list[list[Steer]]):
    """with の中だけ、指定した層の出力（すべての位置）に coef × ベクトルを足す。

    steers を行ごとのリスト（list[list[Steer]]）で渡すと、まとめて生成する1行ずつに違うベクトルを足す。
    """
    rows: list[list[Steer]] = steers if steers and isinstance(steers[0], list) else [steers]  # type: ignore[assignment]
    layers = decoder_layers(model)
    handles = []
    per_layer: dict[int, list[torch.Tensor | None]] = {}
    for r, row in enumerate(rows):
        for s in row:
            data = store.get(s.trait)
            for layer in s.layers or [data["best_layer"]]:
                slot = per_layer.setdefault(layer, [None] * len(rows))
                add = s.coef * data["vectors"][layer]
                slot[r] = add if slot[r] is None else slot[r] + add
    # 層ごとに [行, 1, 次元] の足し算にする（足さない行は0）。1行だけなら全行に同じものを足す
    additions: dict[int, torch.Tensor] = {}
    for layer, slot in per_layer.items():
        dim = next(v for v in slot if v is not None).shape[-1]
        additions[layer] = torch.stack([v if v is not None else torch.zeros(dim) for v in slot]).unsqueeze(1)

    def make_hook(vec: torch.Tensor):
        def hook(_module, _inputs, output):
            hidden = output[0] if isinstance(output, tuple) else output
            hidden = hidden + vec.to(device=hidden.device, dtype=hidden.dtype)
            return (hidden, *output[1:]) if isinstance(output, tuple) else hidden

        return hook

    try:
        for layer, vec in additions.items():
            handles.append(layers[layer].register_forward_hook(make_hook(vec)))
        yield
    finally:
        for h in handles:
            h.remove()


@torch.no_grad()
def generate(model, tok, prompts: list[str], max_new_tokens: int = 220, temperature: float = 0.8, batch_size: int = 16) -> list[str]:
    """文字列のプロンプトをまとめて生成し、返答だけを返す。"""
    outs: list[str] = []
    for i in range(0, len(prompts), batch_size):
        batch = prompts[i : i + batch_size]
        enc = tok(batch, return_tensors="pt", padding=True, add_special_tokens=False).to(model.device)
        gen = model.generate(
            **enc,
            max_new_tokens=max_new_tokens,
            do_sample=temperature > 0,
            temperature=temperature if temperature > 0 else None,
            top_p=0.95 if temperature > 0 else None,
            pad_token_id=tok.pad_token_id,
        )
        for row in gen[:, enc["input_ids"].shape[1] :]:
            outs.append(tok.decode(row, skip_special_tokens=True).strip())
    return outs


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


# 返答の崩れぐあいを見る簡単な目安（評価は最終的に人やAIの採点で行う）
_JA = re.compile(r"[぀-ヿ㐀-鿿＀-￯　-〿\s「」『』（）！？…ー*0-9]")


def japanese_ratio(text: str) -> float:
    """日本語の文字（かな・漢字・全角記号）の割合。崩れたり他の言語が混ざったりすると下がる。"""
    return sum(bool(_JA.match(c)) for c in text) / max(len(text), 1)


def distinct2(text: str) -> float:
    """2文字の並びの種類の割合。同じ言葉の繰り返し（崩壊）が起きると下がる。"""
    grams = [text[i : i + 2] for i in range(len(text) - 1)]
    return len(set(grams)) / max(len(grams), 1)
