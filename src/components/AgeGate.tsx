"use client";

import Image from "next/image";
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
    "w-full appearance-none rounded-2xl bg-night-3 px-4 py-3.5 text-base font-bold text-paper focus:outline-none focus:ring-2 focus:ring-brand/60";

  return (
    <form onSubmit={submit} className="mx-auto w-full max-w-sm px-6 pb-10">
      {plot.cover && (
        <div className="relative -mx-6 h-[38vh] min-h-56 overflow-hidden">
          <Image src={plot.cover} alt="" fill priority sizes="(max-width: 640px) 100vw, 400px" className="object-cover object-[50%_18%]" />
          <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(15,15,19,0)_45%,var(--night))]" />
        </div>
      )}
      <div className={`relative flex flex-col items-center text-center ${plot.cover ? "-mt-9" : "pt-12"}`}>
        <AvatarStack personas={plot.personas} size={plot.cover ? 52 : 60} />
        <h2 className="mt-4 text-[1.4rem] font-black leading-snug">
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
        className="btn-brand press mt-7 w-full rounded-2xl py-4 text-base"
      >
        {busy ? "確認しています" : "物語をはじめる"}
      </button>
      <p className="mt-5 text-center text-xs leading-6 text-mist/80">
        18歳未満の方は、恋愛の表現をおだやかにし、1日の利用を3時間までにしています。
      </p>
    </form>
  );
}
