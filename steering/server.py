"""OpenAI 互換の Chat Completions サーバー（性格ベクトルを足して返す）。

yota の OPENAI_BASE_URL をこのサーバーに向け、OPENAI_MODEL_FAST にベクトルの指定を書くと、本物の画面や評価の道具で試せる。
  model = "base"                          … ベクトルなし
  model = "base+dere=1.2@16"              … 16層目に dere を 1.2 倍で足す
  model = "base+dere=0.8@12,16+sycophancy=-1"  … 複数の層・複数のベクトル（@ を省くとおすすめの層）
リクエストの本文に "steering": "dere=1.2@16" と書いてもよい（model より優先）。

同時に来たリクエストは、少し待ってからまとめて1回で生成する（行ごとに違うベクトルを足せる）。
Spark では1行ずつより、まとめた方がずっと速い（読み出しの帯域で速さが決まるため）。

使い方:
  python server.py --model <HFのid> --port 8000
"""

from __future__ import annotations

import argparse
import json
import queue
import threading
import time
import uuid
from dataclasses import dataclass, field

import torch
import uvicorn
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, StreamingResponse
from transformers.generation.streamers import BaseStreamer

from common import HERE, Steer, VectorStore, chat_prompt, load_model, parse_steers, steering, vectors_dir

ap = argparse.ArgumentParser()
ap.add_argument("--model", required=True)
ap.add_argument("--host", default="0.0.0.0")
ap.add_argument("--port", type=int, default=8000)
ap.add_argument("--max-batch", type=int, default=8)
ap.add_argument("--batch-window", type=float, default=0.4, help="最初のリクエストのあと、まとめるために待つ秒数")
ap.add_argument("--max-new-tokens", type=int, default=400, help="1回の返答の上限（yota の返答は長くても250トークンほど）")
ap.add_argument("--temperature", type=float, default=0.8)
ap.add_argument("--max-coef", type=float, default=4.0, help="強さの上限（壊れた出力や安全でない出力を防ぐ）")
args = ap.parse_args()

model, tok = load_model(args.model)
store = VectorStore(vectors_dir(args.model))
eos_ids = model.generation_config.eos_token_id
eos_ids = set(eos_ids if isinstance(eos_ids, list) else [eos_ids]) | {tok.eos_token_id}
LOG = HERE / "runs" / "server.jsonl"
LOG.parent.mkdir(parents=True, exist_ok=True)


@dataclass
class Job:
    prompt: str
    steers: list[Steer]
    max_new_tokens: int
    out: queue.Queue = field(default_factory=queue.Queue)  # 文字の差分、最後に None
    tokens: int = 0
    spec: str = ""


class RowStreamer(BaseStreamer):
    """まとめて生成した各行の新しいトークンを、行ごとの待ち行列に文字の差分として流す。"""

    def __init__(self, jobs: list[Job]):
        self.jobs = jobs
        self.first = True
        self.ids: list[list[int]] = [[] for _ in jobs]
        self.sent = [""] * len(jobs)
        self.done = [False] * len(jobs)

    def _finish(self, i: int):
        if not self.done[i]:
            self.done[i] = True
            self.jobs[i].out.put(None)

    def put(self, value):
        if self.first:  # 最初はプロンプト
            self.first = False
            return
        toks = value.view(-1).tolist()
        for i, t in enumerate(toks):
            if self.done[i]:
                continue
            if t in eos_ids:
                self._finish(i)
                continue
            self.ids[i].append(t)
            self.jobs[i].tokens += 1
            text = tok.decode(self.ids[i], skip_special_tokens=True)
            if not text.endswith("�"):  # 文字の途中（バイトが足りない）なら次を待つ
                delta = text[len(self.sent[i]) :]
                if delta:
                    self.sent[i] = text
                    self.jobs[i].out.put(delta)
            if len(self.ids[i]) >= self.jobs[i].max_new_tokens:
                self._finish(i)

    def end(self):
        for i in range(len(self.jobs)):
            self._finish(i)


jobs_q: queue.Queue[Job] = queue.Queue()


def run_batch(batch: list[Job]):
    t0 = time.time()
    enc = tok([j.prompt for j in batch], return_tensors="pt", padding=True, add_special_tokens=False).to(model.device)
    streamer = RowStreamer(batch)
    try:
        with torch.no_grad(), steering(model, store, [j.steers for j in batch]):
            model.generate(
                **enc,
                max_new_tokens=max(j.max_new_tokens for j in batch),
                do_sample=args.temperature > 0,
                temperature=args.temperature if args.temperature > 0 else None,
                top_p=0.95 if args.temperature > 0 else None,
                pad_token_id=tok.pad_token_id,
                streamer=streamer,
            )
    except Exception as e:  # 失敗はリクエスト側に知らせる
        for j in batch:
            j.out.put(RuntimeError(str(e)))
        streamer.end()
        return
    streamer.end()
    sec = time.time() - t0
    toks = sum(j.tokens for j in batch)
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(json.dumps({"t": time.time(), "batch": len(batch), "seconds": round(sec, 2), "tokens": toks, "tok_per_s": round(toks / sec, 1), "specs": [j.spec for j in batch]}, ensure_ascii=False) + "\n")
    print(f"まとめて{len(batch)}件 {toks}トークン {sec:.1f}秒（{toks / sec:.1f} tok/s）")


def worker():
    while True:
        batch = [jobs_q.get()]
        deadline = time.time() + args.batch_window
        while len(batch) < args.max_batch:
            try:
                batch.append(jobs_q.get(timeout=max(0.0, deadline - time.time())))
            except queue.Empty:
                break
        run_batch(batch)


threading.Thread(target=worker, daemon=True).start()
app = FastAPI()


def make_job(body: dict) -> Job:
    spec = body.get("steering") or str(body.get("model", "base")).partition("+")[2]
    steers = parse_steers(spec)
    for s in steers:
        if abs(s.coef) > args.max_coef:
            raise ValueError(f"強さは ±{args.max_coef} までです: {s.trait}={s.coef}")
        store.get(s.trait)  # ベクトルがなければここでエラー
    messages = body.get("messages", [])
    prompt = chat_prompt(tok, None, messages)
    limit = int(body.get("max_completion_tokens") or body.get("max_tokens") or args.max_new_tokens)
    return Job(prompt=prompt, steers=steers, max_new_tokens=min(limit, args.max_new_tokens), spec=spec or "base")


def chunk(cid: str, delta: dict, finish: str | None = None) -> str:
    return "data: " + json.dumps({"id": cid, "object": "chat.completion.chunk", "model": "base", "choices": [{"index": 0, "delta": delta, "finish_reason": finish}]}, ensure_ascii=False) + "\n\n"


@app.post("/v1/chat/completions")
async def completions(request: Request):
    body = await request.json()
    try:
        job = make_job(body)
    except (ValueError, FileNotFoundError) as e:
        return JSONResponse({"error": {"message": str(e)}}, status_code=400)
    jobs_q.put(job)
    cid = f"chatcmpl-{uuid.uuid4().hex[:12]}"

    def pieces():
        while True:
            item = job.out.get()
            if item is None:
                return
            if isinstance(item, Exception):
                raise item
            yield item

    if body.get("stream"):
        def sse():
            yield chunk(cid, {"role": "assistant"})
            try:
                for p in pieces():
                    yield chunk(cid, {"content": p})
            except RuntimeError as e:
                yield "data: " + json.dumps({"error": {"message": str(e)}}) + "\n\n"
            yield chunk(cid, {}, "stop")
            yield "data: [DONE]\n\n"

        return StreamingResponse(sse(), media_type="text/event-stream")
    try:
        text = "".join(pieces())
    except RuntimeError as e:
        return JSONResponse({"error": {"message": str(e)}}, status_code=500)
    return {"id": cid, "object": "chat.completion", "model": body.get("model", "base"), "choices": [{"index": 0, "message": {"role": "assistant", "content": text}, "finish_reason": "stop"}], "usage": {"completion_tokens": job.tokens}}


@app.get("/v1/models")
def models():
    return {"object": "list", "data": [{"id": "base", "object": "model"}] + [{"id": f"base+{t}=1", "object": "model"} for t in store.available()]}


@app.get("/health")
def health():
    return {"ok": True, "model": args.model, "vectors": store.available()}


if __name__ == "__main__":
    uvicorn.run(app, host=args.host, port=args.port, log_level="warning")
