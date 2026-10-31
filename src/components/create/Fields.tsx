"use client";

import { createContext, useContext, useRef, useState } from "react";
import { SparkleIcon } from "@/components/icons";
import type { AssistField, AssistOption } from "@/lib/ugc-assist";

/** 「AIで考える」を呼ぶ関数。作る画面が、いま書いている作品を添えて送る */
export type Ask = (field: AssistField, index?: number) => Promise<{ options?: AssistOption[]; error?: string }>;
export const AiContext = createContext<Ask>(async () => ({ error: "使えません" }));

export const inputClass =
  "mt-1.5 w-full rounded-xl bg-night-3 px-3 py-2.5 text-[0.92rem] leading-6 text-paper placeholder:text-mist/60 focus:outline-none focus:ring-2 focus:ring-brand/60";

/** 「AIで考える」のボタンと、出てきた案の一覧。案を押すと onPick に渡す（multi なら何度でも選べる） */
export function AiAssist({
  field,
  index,
  onPick,
  multi = false,
  label = "AIで考える",
}: {
  field: AssistField;
  index?: number;
  onPick: (o: AssistOption) => void;
  multi?: boolean;
  label?: string;
}) {
  const ask = useContext(AiContext);
  const [state, setState] = useState<"idle" | "loading" | "open">("idle");
  const [options, setOptions] = useState<AssistOption[]>([]);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setState("loading");
    setError(null);
    setPicked(new Set());
    const r = await ask(field, index);
    setOptions(r.options ?? []);
    setError(r.options?.length ? null : (r.error ?? "案を考えられませんでした"));
    setState("open");
  }

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={run}
        data-ai={index === undefined ? field : `${field}-${index}`}
        disabled={state === "loading"}
        className="press inline-flex shrink-0 items-center gap-1 rounded-full bg-brand/15 px-2.5 py-1 text-[0.72rem] font-bold text-brand disabled:opacity-60"
      >
        <SparkleIcon size={13} />
        {state === "loading" ? "考えています…" : label}
      </button>
      {state === "open" && (
        <div data-ai-options className="absolute right-0 top-full z-30 mt-1.5 max-h-[60vh] w-[min(calc(100vw-2.5rem),30rem)] overflow-y-auto rounded-xl border border-brand/30 bg-night-2 p-2 shadow-2xl shadow-black/60">
          {error && <p className="px-1 py-1 text-[0.8rem] text-amber">{error}</p>}
          <ul className="space-y-1.5">
            {options.map((o, i) => (
              <li key={i}>
                <button
                  type="button"
                  disabled={picked.has(i)}
                  onClick={() => {
                    onPick(o);
                    if (multi) setPicked((s) => new Set(s).add(i));
                    else setState("idle");
                  }}
                  className="press w-full whitespace-pre-wrap rounded-lg bg-night-3 px-3 py-2 text-left text-[0.85rem] leading-6 text-paper/95 hover:bg-night-3/70 disabled:opacity-40"
                >
                  {typeof o === "string" ? (
                    o
                  ) : (
                    <>
                      <span className="text-mist">相手「{o.user}」</span>
                      <br />→「{o.reply}」
                    </>
                  )}
                  {multi && <span className="ml-1 text-[0.72rem] font-bold text-brand">{picked.has(i) ? "追加しました" : "＋追加"}</span>}
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-1.5 flex justify-end gap-1">
            <button type="button" onClick={run} className="press rounded-full px-3 py-1 text-[0.75rem] font-bold text-mist hover:text-paper">
              ほかの案
            </button>
            <button type="button" onClick={() => setState("idle")} className="press rounded-full px-3 py-1 text-[0.75rem] font-bold text-mist hover:text-paper">
              閉じる
            </button>
          </div>
        </div>
      )}
    </span>
  );
}

/** 見出し（必須・任意の印、文字数、AIのボタン）つきの入力欄 */
export function TextField({
  id,
  label,
  value,
  onChange,
  max,
  rows,
  required = false,
  hint,
  placeholder,
  ai,
  aiIndex,
  userToken = false,
  inputMode,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  max: number;
  rows?: number;
  required?: boolean;
  hint?: React.ReactNode;
  placeholder?: string;
  ai?: AssistField;
  aiIndex?: number;
  /** {{user}}（遊ぶ人の名前）を入れるボタンを出す */
  userToken?: boolean;
  inputMode?: "numeric";
}) {
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const len = Array.from(value).length;
  const missing = required && !value.trim();

  function insertUser() {
    const el = ref.current;
    const at = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? at;
    const next = value.slice(0, at) + "{{user}}" + value.slice(end);
    if (Array.from(next).length > max) return;
    onChange(next);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(at + 8, at + 8);
    });
  }

  return (
    <div className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1">
      <label htmlFor={id} className="flex items-center gap-1.5 text-[0.8rem] font-bold text-paper/90">
        {label}
        <span className={`rounded px-1 py-px text-[0.62rem] font-bold ${required ? (missing ? "bg-amber/20 text-amber" : "bg-night-3 text-mist") : "text-mist/70"}`}>
          {required ? "必須" : "任意"}
        </span>
      </label>
      <span className="ml-auto flex items-center gap-1.5">
        {userToken && (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={insertUser}
            className="press rounded-full bg-night-3 px-2 py-1 text-[0.68rem] font-bold text-mist hover:text-paper"
            title="遊ぶ人の名前になります"
          >
            ＋{"{{user}}"}
          </button>
        )}
        {ai && <AiAssist field={ai} index={aiIndex} onPick={(o) => typeof o === "string" && onChange(o.slice(0, max))} />}
      </span>
      <div className="w-full basis-full">
        {rows ? (
          <textarea
            ref={ref}
            id={id}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            maxLength={max}
            rows={rows}
            placeholder={placeholder}
            className={inputClass}
          />
        ) : (
          <input
            ref={ref}
            id={id}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            maxLength={max}
            placeholder={placeholder}
            inputMode={inputMode}
            className={inputClass}
          />
        )}
        <div className="mt-1 flex gap-2 text-[0.7rem] leading-5 text-mist/80">
          <span className="flex-1">{hint}</span>
          <span className={`tabular-nums ${len > max * 0.9 ? "text-amber" : ""}`}>
            {len}/{max}
          </span>
        </div>
      </div>
    </div>
  );
}

/** 短い言葉を並べる欄（タグ・山場・返事の候補）。1行ずつ足し引きできる */
export function ListField({
  id,
  label,
  items,
  onChange,
  maxItems,
  maxLen,
  hint,
  placeholder,
  ai,
  chips = false,
}: {
  id: string;
  label: string;
  items: string[];
  onChange: (v: string[]) => void;
  maxItems: number;
  maxLen: number;
  hint?: React.ReactNode;
  placeholder?: string;
  ai?: AssistField;
  /** タグのように、丸い札で並べる */
  chips?: boolean;
}) {
  const [text, setText] = useState("");
  const add = (v: string) => {
    const s = v.trim().replace(/^#/, "").slice(0, maxLen);
    if (!s || items.includes(s) || items.length >= maxItems) return;
    onChange([...items, s]);
  };
  return (
    <div className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1">
      <label htmlFor={id} className="flex items-center gap-1.5 text-[0.8rem] font-bold text-paper/90">
        {label}
        <span className="text-[0.62rem] font-bold text-mist/70">任意</span>
      </label>
      <span className="ml-auto">{ai && items.length < maxItems && <AiAssist field={ai} multi onPick={(o) => typeof o === "string" && add(o)} />}</span>
      <div className="w-full basis-full">
        {items.length > 0 && (
          <ul className={chips ? "mt-1.5 flex flex-wrap gap-1.5" : "mt-1.5 space-y-1.5"}>
            {items.map((it, i) => (
              <li
                key={it + i}
                className={chips ? "flex items-center gap-1 rounded-full bg-night-3 py-1 pl-3 pr-1 text-[0.8rem]" : "flex items-start gap-2 rounded-xl bg-night-3 px-3 py-2 text-[0.85rem] leading-6"}
              >
                <span className="flex-1">{chips ? `#${it}` : it}</span>
                <button
                  type="button"
                  aria-label={`${it} を消す`}
                  onClick={() => onChange(items.filter((_, j) => j !== i))}
                  className="press grid size-6 shrink-0 place-items-center rounded-full text-mist hover:text-paper"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        {items.length < maxItems && (
          <div className="flex gap-2">
            <input
              id={id}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  add(text);
                  setText("");
                }
              }}
              maxLength={maxLen}
              placeholder={placeholder}
              className={inputClass}
            />
            <button
              type="button"
              onClick={() => {
                add(text);
                setText("");
              }}
              disabled={!text.trim()}
              className="press mt-1.5 shrink-0 rounded-xl bg-night-3 px-3.5 text-sm font-bold disabled:opacity-40"
            >
              追加
            </button>
          </div>
        )}
        <p className="mt-1 text-[0.7rem] leading-5 text-mist/80">
          {hint} {items.length}/{maxItems}
        </p>
      </div>
    </div>
  );
}

/** 選択肢のボタン（1つだけ選ぶ） */
export function Choice<T extends string>({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: T;
  options: { value: T; title: string; hint: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div id={id} className="mt-5">
      <p className="text-[0.8rem] font-bold text-paper/90">{label}</p>
      <div role="radiogroup" aria-label={label} className="mt-1.5 grid grid-cols-2 gap-2">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={`press rounded-2xl px-3 py-2.5 text-left ${value === o.value ? "bg-paper text-night" : "bg-night-3 text-paper"}`}
          >
            <span className="block text-[0.85rem] font-black">{o.title}</span>
            <span className={`mt-0.5 block text-[0.7rem] leading-4 ${value === o.value ? "text-night/70" : "text-mist"}`}>{o.hint}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
