"use client";

import { useState, useSyncExternalStore } from "react";
import { api } from "@/lib/client";
import { COMPARE, SCORES, type Compare } from "@/lib/feedback";

const key = (conversationId: string) => `yota_fb_${conversationId}`;
const subscribe = () => () => {};

/** この会話で、もう評価を送ったか閉じたか（端末に覚える。読めない環境では毎回出さない） */
function useAnswered(conversationId: string): boolean {
  return useSyncExternalStore(
    subscribe,
    () => {
      try {
        return localStorage.getItem(key(conversationId)) !== null;
      } catch {
        return true;
      }
    },
    () => true,
  );
}

function remember(conversationId: string, value: string) {
  try {
    localStorage.setItem(key(conversationId), value);
  } catch {
    // 覚えられなくても、この画面では閉じる
  }
}

/**
 * 会話のあとのひとこと評価。何往復か話したところで、会話の下に1回だけ出す（会話の邪魔をしないよう、ポップアップにはしない）。
 * 点数を押すと、ほかのアプリとの比べと、ひとことの欄が開く
 */
export function FeedbackPrompt({ conversationId, names }: { conversationId: string; names: string }) {
  const answered = useAnswered(conversationId);
  const [closed, setClosed] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [compare, setCompare] = useState<Compare | null>(null);
  const [text, setText] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  if ((answered || closed) && state !== "sent") return null;
  if (state === "sent") {
    return <p className="arrive mt-6 rounded-2xl bg-night-2 px-4 py-3 text-center text-sm text-paper/90">ありがとうございます！ いただいた声は、物語づくりに使わせていただきます。</p>;
  }

  async function send() {
    if (score === null) return;
    setState("sending");
    const r = await api("/api/feedback", {
      method: "POST",
      body: JSON.stringify({ kind: "rating", conversationId, score, ...(compare ? { compare } : {}), ...(text.trim() ? { text } : {}) }),
    });
    if (!r.ok) return setState("error");
    remember(conversationId, String(score));
    setState("sent");
  }

  return (
    <section aria-label="ここまでの会話の評価" className="arrive mt-6 rounded-2xl bg-night-2 p-4 ring-1 ring-white/5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[0.9rem] font-bold leading-6">ここまでの{names}との会話、どうでしたか？</p>
        <button
          onClick={() => {
            remember(conversationId, "closed");
            setClosed(true);
          }}
          className="press shrink-0 text-xs font-bold text-mist hover:text-paper"
        >
          閉じる
        </button>
      </div>
      <div role="radiogroup" aria-label="評価" className="mt-3 grid grid-cols-5 gap-1.5">
        {SCORES.map((s) => (
          <button
            key={s.score}
            role="radio"
            aria-checked={score === s.score}
            onClick={() => setScore(s.score)}
            className={`press flex flex-col items-center gap-0.5 rounded-xl py-2 text-[0.7rem] font-bold ${
              score === s.score ? "bg-paper text-night" : "bg-night-3 text-mist hover:text-paper"
            }`}
          >
            <span aria-hidden className="text-xl leading-none">
              {s.emoji}
            </span>
            {s.label}
          </button>
        ))}
      </div>
      {score !== null && (
        <div className="arrive mt-4">
          <p className="text-xs font-bold text-mist">ふだん使っている、ほかのキャラチャットアプリと比べると？（任意）</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(Object.keys(COMPARE) as Compare[]).map((c) => (
              <button
                key={c}
                aria-pressed={compare === c}
                onClick={() => setCompare(compare === c ? null : c)}
                className={`press rounded-full px-3 py-1.5 text-[0.75rem] font-bold ${compare === c ? "bg-paper text-night" : "bg-night-3 text-mist hover:text-paper"}`}
              >
                {COMPARE[c]}
              </button>
            ))}
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={500}
            rows={3}
            aria-label="ひとこと（任意）"
            placeholder="ひとこと（任意）：よかった台詞、気になったところなど"
            className="mt-3 w-full rounded-xl bg-night-3 px-3 py-2.5 text-sm leading-6 placeholder:text-mist/70 focus:outline-none focus:ring-1 focus:ring-brand"
          />
          {state === "error" && <p className="mt-2 text-xs text-amber">送れませんでした。もう一度お試しください。</p>}
          <button onClick={send} disabled={state === "sending"} className="press btn-brand mt-2 w-full rounded-xl py-2.5 text-sm">
            {state === "sending" ? "送っています" : "送る"}
          </button>
        </div>
      )}
    </section>
  );
}
