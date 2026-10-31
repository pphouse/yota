"use client";

import Image from "next/image";
import { useState } from "react";
import { AvatarStack } from "@/components/Avatar";
import { ChevronDownIcon } from "@/components/icons";
import type { Plot } from "@/lib/characters";
import { api } from "@/lib/client";
import { storedRef } from "@/lib/ref";
import { USER_NAME_MAX } from "@/lib/username";

/**
 * 物語を始める前に一度だけ、物語の中で呼ばれる名前と、生まれた年月を聞く。アカウント登録はまだ求めない。
 * nameOnly は、年齢の確認は済んでいるが名前をまだ決めていないとき（名前だけ聞く）。
 */
export function AgeGate({ plot, nameOnly = false, onDone }: { plot: Plot; nameOnly?: boolean; onDone: (isMinor: boolean) => void }) {
  const thisYear = new Date().getFullYear();
  const [name, setName] = useState("");
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await api<{ session?: { isMinor: boolean }; error?: string }>("/api/session", {
      method: nameOnly ? "PATCH" : "POST",
      body: JSON.stringify(nameOnly ? { name } : { name, birthYear: Number(year), birthMonth: Number(month), ref: storedRef() }),
    });
    setBusy(false);
    if (!res.ok || !res.data.session) {
      setError(res.data.error ?? "確認できませんでした。もう一度試してください。");
      return;
    }
    onDone(res.data.session.isMinor);
  }

  const select =
    "w-full appearance-none rounded-2xl bg-night-3 py-3.5 pl-4 pr-10 text-base font-bold text-paper focus:outline-none focus:ring-2 focus:ring-brand/70";

  return (
    <form onSubmit={submit} className="mx-auto w-full max-w-xl pb-10">
      {plot.cover && (
        <div className="relative h-[38vh] [mask-image:linear-gradient(to_bottom,black_45%,transparent)]">
          <Image
            src={plot.cover}
            alt=""
            fill
            sizes="(min-width: 576px) 576px, 100vw"
            preload
            className="object-cover object-[50%_18%]"
          />
        </div>
      )}
      <div className={`mx-auto max-w-sm px-6 ${plot.cover ? "-mt-10" : "pt-12"} relative`}>
        <div className="flex flex-col items-center text-center">
          <AvatarStack personas={plot.personas} size={60} />
          <h2 className="mt-4 text-[1.45rem] font-black leading-snug">{nameOnly ? "名前を決める" : "はじめる前に"}</h2>
          <p className="break-phrase mt-2.5 text-[0.85rem] leading-7 text-mist">
            {nameOnly
              ? "物語の中で、キャラがあなたをこの名前で呼びます。"
              : "名前と生まれた年月を入力してください。生まれた年月は年齢の確認にだけ使います。メールアドレスの登録はいりません。"}
          </p>
        </div>
        <label className="mt-6 block text-xs font-bold text-mist">
          あなたの名前
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={USER_NAME_MAX}
            autoComplete="nickname"
            enterKeyHint="next"
            placeholder="例：みお"
            className="mt-1.5 w-full rounded-2xl bg-night-3 px-4 py-3.5 text-base font-bold text-paper placeholder:font-normal placeholder:text-mist/60 focus:outline-none focus:ring-2 focus:ring-brand/70"
          />
          <span className="mt-1.5 block font-normal text-mist/80">ニックネームでかまいません。あとから変えられます。</span>
        </label>
        {!nameOnly && (
          <div className="mt-5 grid grid-cols-[1.4fr_1fr] gap-3">
            <label className="block text-xs font-bold text-mist">
              生まれた年
              <span className="relative mt-1.5 block">
                <select required value={year} onChange={(e) => setYear(e.target.value)} className={select}>
                  <option value="" disabled>
                    選ぶ
                  </option>
                  {Array.from({ length: 90 }, (_, i) => thisYear - 8 - i).map((y) => (
                    <option key={y} value={y}>
                      {y}年
                    </option>
                  ))}
                </select>
                <ChevronDownIcon size={18} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-mist" />
              </span>
            </label>
            <label className="block text-xs font-bold text-mist">
              月
              <span className="relative mt-1.5 block">
                <select required value={month} onChange={(e) => setMonth(e.target.value)} className={select}>
                  <option value="" disabled>
                    選ぶ
                  </option>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>
                      {m}月
                    </option>
                  ))}
                </select>
                <ChevronDownIcon size={18} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-mist" />
              </span>
            </label>
          </div>
        )}
        {error && (
          <p role="alert" className="mt-4 text-sm text-amber">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy || !name.trim() || (!nameOnly && (!year || !month))}
          className="press btn-brand mt-6 w-full rounded-2xl py-4 text-base"
        >
          {busy ? "確認しています" : "物語をはじめる"}
        </button>
        {!nameOnly && (
          <p className="mt-4 text-center text-xs leading-6 text-mist/80">
            18歳未満の方は、恋愛の表現をおだやかにし、1日の利用を3時間までにしています。
          </p>
        )}
      </div>
    </form>
  );
}
