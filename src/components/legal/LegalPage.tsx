import Link from "next/link";
import { BackIcon } from "@/components/icons";

/** 利用規約・プライバシーポリシーの共通の見た目 */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-xl px-5 pb-20">
      <header className="sticky top-0 z-20 -mx-5 bg-night/80 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="flex h-12 items-center gap-2 px-3">
          <Link href="/settings" aria-label="設定へ" className="press grid size-9 place-items-center rounded-full text-mist hover:text-paper">
            <BackIcon size={22} />
          </Link>
          <h1 className="text-[0.95rem] font-bold">{title}</h1>
        </div>
      </header>
      <article className="legal mt-4 text-[0.9rem] leading-7 text-paper/90">
        {children}
        <p className="mt-10 text-[0.8rem] text-mist">最終更新：{updated}</p>
      </article>
    </main>
  );
}

export function H({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-8 text-[1rem] font-black text-paper">{children}</h2>;
}

export function Ul({ children }: { children: React.ReactNode }) {
  return <ul className="mt-2 list-disc space-y-1 pl-5">{children}</ul>;
}
