"use client";

import { useState } from "react";
import { AvatarStack } from "@/components/Avatar";
import { callName, type Plot } from "@/lib/characters";
import { api } from "@/lib/client";

/** 物語を始める前に一度だけ、生まれた年と月を聞く。アカウント登録はまだ求めない。 */
export function AgeGate({ plot, onDone }: { plot: Plot; onDone: (isMinor: boolean) => void }) {
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
    "w-full appearance-none rounded-2xl border border-line bg-night-2 px-4 py-3.5 text-base text-paper focus:border-tint focus:outline-none";

  return (
    <form onSubmit={submit} className="mx-auto w-full max-w-sm px-6 pb-10 pt-12">
      <div className="flex flex-col items-center text-center">
        <AvatarStack personas={plot.personas} size={60} />
        <h2 className="mt-5 font-mincho text-[1.45rem] font-bold leading-snug">
          {plot.personas.map(callName).join("と")}が待っています
        </h2>
        <p className="mt-3 text-[0.88rem] leading-7 text-mist">
          物語の表現を年齢に合わせるため、生まれた年と月だけ教えてください。名前やメールアドレスはいりません。
        </p>
      </div>
      <div className="mt-8 grid grid-cols-[1.4fr_1fr] gap-3">
        <label className="block text-xs font-medium text-mist">
          生まれた年
          <select required value={year} onChange={(e) => setYear(e.target.value)} className={`${select} mt-1.5`}>
            <option value="" disabled>
              選ぶ
            </option>
            {Array.from({ length: 90 }, (_, i) => thisYear - 8 - i).map((y) => (
              <option key={y} value={y}>
                {y}年
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-mist">
          月
          <select required value={month} onChange={(e) => setMonth(e.target.value)} className={`${select} mt-1.5`}>
            <option value="" disabled>
              選ぶ
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
        className="press mt-7 w-full rounded-full bg-tint py-4 text-[0.95rem] font-bold text-night disabled:bg-night-3 disabled:text-mist"
      >
        {busy ? "確認しています" : "物語をはじめる"}
      </button>
      <p className="mt-5 text-center text-xs leading-6 text-mist/80">
        18歳未満の方は、恋愛の表現をおだやかにし、1日の利用を3時間までにしています。
      </p>
    </form>
  );
}
