"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { FeedbackSheet } from "@/components/FeedbackSheet";
import { BackIcon } from "@/components/icons";
import { api } from "@/lib/client";
import { enablePush, pushAvailable, pushPermission } from "@/lib/native";

type Block = { id: string; author: string; createdAt: number };
type Push = "granted" | "denied" | "prompt" | "unsupported" | null;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="px-1 text-[0.78rem] font-bold text-mist">{title}</h2>
      <div className="mt-2 divide-y divide-night-3 overflow-hidden rounded-2xl bg-night-2">{children}</div>
    </section>
  );
}

const noop = () => () => {};

const row = "flex min-h-14 w-full items-center justify-between gap-3 px-4 py-3 text-left text-[0.92rem]";

/** 設定：通知・ブロックした作者・ご意見・規約・退会 */
export function Settings() {
  const router = useRouter();
  // アプリの中で、通知が使えるか（サーバーで描くときは false。変わらないので購読はしない）
  const canPush = useSyncExternalStore(noop, pushAvailable, () => false);
  const [push, setPush] = useState<Push>(null);
  const [blocks, setBlocks] = useState<Block[] | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    void pushPermission().then(setPush);
    void api<{ items: Block[] }>("/api/blocks").then((r) => setBlocks(r.ok ? r.data.items : []));
  }, []);

  async function turnOnPush() {
    const r = await enablePush();
    setPush(r === "granted" ? "granted" : r === "denied" ? "denied" : "unsupported");
  }

  async function unblock(id: string) {
    await api(`/api/blocks?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    setBlocks((b) => (b ?? []).filter((x) => x.id !== id));
  }

  async function deleteAll() {
    setDeleting(true);
    setDeleteError(null);
    const r = await api("/api/session", { method: "DELETE" });
    setDeleting(false);
    if (!r.ok) return setDeleteError("削除できませんでした。時間をおいてもう一度お試しください。");
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      // 保存領域が使えない環境では何もしない
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <main className="mx-auto w-full max-w-xl px-5 pb-16">
      <header className="sticky top-0 z-20 -mx-5 bg-night/80 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="flex h-12 items-center gap-2 px-3">
          <Link href="/" aria-label="ホームへ" className="press grid size-9 place-items-center rounded-full text-mist hover:text-paper">
            <BackIcon size={22} />
          </Link>
          <h1 className="text-[0.95rem] font-bold">設定</h1>
        </div>
      </header>

      {canPush && (
        <Section title="通知">
          <div className={row}>
            <div>
              <p className="font-bold">キャラからのお知らせ</p>
              <p className="mt-0.5 text-[0.78rem] leading-5 text-mist">新しい作品や、続きを遊べるときにお知らせします。</p>
            </div>
            {push === "granted" ? (
              <span className="shrink-0 text-[0.8rem] font-bold text-brand">オン</span>
            ) : push === "denied" ? (
              <span className="shrink-0 text-right text-[0.75rem] leading-5 text-mist">端末の設定アプリ<br />から許可できます</span>
            ) : (
              <button onClick={turnOnPush} className="press shrink-0 rounded-full bg-brand-grad px-4 py-2 text-[0.8rem] font-bold text-white">
                オンにする
              </button>
            )}
          </div>
        </Section>
      )}

      <Section title="ブロックした作者">
        {blocks === null ? (
          <p className={`${row} text-mist`}>読み込み中…</p>
        ) : blocks.length === 0 ? (
          <p className={`${row} text-[0.85rem] text-mist`}>ブロックした作者はいません。作品のページの下からブロックできます。</p>
        ) : (
          blocks.map((b) => (
            <div key={b.id} className={row}>
              <span className="truncate">{b.author || "名前のない作者"}</span>
              <button onClick={() => unblock(b.id)} className="press shrink-0 rounded-full bg-night-3 px-3 py-1.5 text-[0.78rem] font-bold">
                解除する
              </button>
            </div>
          ))
        )}
      </Section>

      <Section title="yota について">
        <div className={row}>
          <FeedbackSheet label="ご意見・お問い合わせ・通報" />
        </div>
        <Link href="/support" className={`${row} press`}>
          サポート・よくある質問<span aria-hidden className="text-mist">›</span>
        </Link>
        <Link href="/terms" className={`${row} press`}>
          利用規約<span aria-hidden className="text-mist">›</span>
        </Link>
        <Link href="/privacy" className={`${row} press`}>
          プライバシーポリシー<span aria-hidden className="text-mist">›</span>
        </Link>
      </Section>

      <Section title="データ">
        {!confirming ? (
          <button onClick={() => setConfirming(true)} className={`${row} press text-red-300`}>
            データをすべて削除して退会する
          </button>
        ) : (
          <div className="px-4 py-4 text-[0.88rem] leading-7">
            <p className="font-bold">本当に削除しますか？</p>
            <p className="mt-1 text-mist">
              会話の履歴、作った作品と画像、Xの診断結果、ご意見、通知の登録がすべて消えます。元に戻せません。
            </p>
            {deleteError && <p className="mt-2 text-red-300">{deleteError}</p>}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button onClick={() => setConfirming(false)} disabled={deleting} className="press rounded-full bg-night-3 py-3 text-sm font-bold">
                やめる
              </button>
              <button onClick={deleteAll} disabled={deleting} className="press rounded-full bg-red-500/90 py-3 text-sm font-bold text-white">
                {deleting ? "削除しています…" : "削除する"}
              </button>
            </div>
          </div>
        )}
      </Section>
    </main>
  );
}
