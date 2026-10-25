"use client";

import { useState } from "react";
import { api } from "@/lib/client";

/** 物語を始める前に一度だけ、生まれた年と月を聞く。アカウント登録はまだ求めない。 */
export function AgeGate({ onDone }: { onDone: (isMinor: boolean) => void }) {
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await api<{ session?: { isMinor: boolean }; error?: string }>("/api/session", {
      method: "POST",
      body: JSON.stringify({ birthYear: Number(year), birthMonth: Number(month) }),
    });
    setBusy(false);
    if (!res.ok || !res.data.session) {
      setError(res.data.error ?? "確認できませんでした。もう一度試してください。");
      return;
    }
    onDone(res.data.session.isMinor);
  }

  const select =
    "w-full appearance-none rounded-lg border border-line bg-night px-4 py-3 text-base text-paper focus:border-tint";

  return (
    <form onSubmit={submit} className="mx-auto w-full max-w-sm px-5 py-10">
      <h2 className="font-mincho text-2xl leading-snug">はじめる前に</h2>
      <p className="mt-3 text-sm leading-7 text-mist">
        年齢に合わせて物語の表現を調整するため、生まれた年と月を教えてください。名前やメールアドレスは必要ありません。
      </p>
      <div className="mt-6 grid grid-cols-2 gap-3">
        <label className="block text-xs text-mist">
          生まれた年
          <select required value={year} onChange={(e) => setYear(e.target.value)} className={`${select} mt-1.5`}>
            <option value="" disabled>
              選択
            </option>
            {Array.from({ length: 90 }, (_, i) => thisYear - 8 - i).map((y) => (
              <option key={y} value={y}>
                {y}年
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-mist">
          月
          <select required value={month} onChange={(e) => setMonth(e.target.value)} className={`${select} mt-1.5`}>
            <option value="" disabled>
              選択
            </option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {m}月
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && (
        <p role="alert" className="mt-4 text-sm text-amber">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy || !year || !month}
        className="mt-6 w-full rounded-full bg-paper py-3.5 text-sm font-semibold text-night disabled:opacity-40"
      >
        {busy ? "確認しています" : "物語をはじめる"}
      </button>
      <p className="mt-4 text-xs leading-6 text-mist">18歳未満の方は、恋愛表現をおだやかにし、1日の利用時間を3時間までにしています。</p>
    </form>
  );
}
