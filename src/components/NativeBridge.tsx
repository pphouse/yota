"use client";

import { useEffect } from "react";
import { isNativeApp, openExternal } from "@/lib/native";

/** アプリの中で開いたままにする場所（X のログイン画面。cookie をアプリに残すため） */
const IN_APP_HOSTS = [/(^|\.)x\.com$/, /(^|\.)twitter\.com$/];

function isExternal(url: URL): boolean {
  if (url.origin === window.location.origin) return false;
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  return true;
}

/** X のログイン（OAuth）の画面だけは、アプリの中で開く */
function isLoginFlow(url: URL): boolean {
  return IN_APP_HOSTS.some((h) => h.test(url.hostname)) && /\/(i\/oauth2|oauth)/.test(url.pathname);
}

/** 通知やリンクから受け取った行き先を、yota の中のパスにする。外の場所なら null */
function toInternalPath(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw) return null;
  try {
    const url = new URL(raw, window.location.origin);
    return url.origin === window.location.origin ? url.pathname + url.search + url.hash : null;
  } catch {
    return null;
  }
}

/**
 * iOS / Android アプリの中で動くときだけ働く部品。画面には何も出さない。
 * - 起動画面を閉じ、ステータスバーを暗い背景に合わせる
 * - yota の外へのリンクは、アプリ内ブラウザで開く（アプリの画面が外のサイトに置きかわらないように）
 * - Android の戻るボタンで、前の画面に戻る
 * - 通知やリンク（yotachat.app/...）を押して開いたら、その画面へ移る
 */
export function NativeBridge() {
  useEffect(() => {
    if (!isNativeApp()) return;
    document.documentElement.dataset.native = "1";
    const cleanups: (() => void)[] = [];
    let alive = true;

    void (async () => {
      const [{ SplashScreen }, { StatusBar, Style }, { App }, { PushNotifications }] = await Promise.all([
        import("@capacitor/splash-screen"),
        import("@capacitor/status-bar"),
        import("@capacitor/app"),
        import("@capacitor/push-notifications"),
      ]);
      if (!alive) return;
      await StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
      await SplashScreen.hide().catch(() => {});

      const back = await App.addListener("backButton", ({ canGoBack }) => {
        if (canGoBack) window.history.back();
        else void App.minimizeApp();
      });
      const opened = await App.addListener("appUrlOpen", ({ url }) => {
        const path = toInternalPath(url);
        if (path) window.location.assign(path);
      });
      const tapped = await PushNotifications.addListener("pushNotificationActionPerformed", ({ notification }) => {
        const path = toInternalPath((notification.data as Record<string, unknown> | undefined)?.path);
        if (path) window.location.assign(path);
      });
      cleanups.push(() => void back.remove(), () => void opened.remove(), () => void tapped.remove());
    })();

    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a) return;
      let url: URL;
      try {
        url = new URL(a.href, window.location.href);
      } catch {
        return;
      }
      if (!isExternal(url) || isLoginFlow(url)) return;
      e.preventDefault();
      void openExternal(url.toString());
    }
    document.addEventListener("click", onClick, true);
    cleanups.push(() => document.removeEventListener("click", onClick, true));

    // window.open で外のページを開く処理も、アプリ内ブラウザに回す
    const originalOpen = window.open.bind(window);
    window.open = (target?: string | URL, name?: string, features?: string) => {
      try {
        const url = new URL(String(target ?? ""), window.location.href);
        if (isExternal(url) && !isLoginFlow(url)) {
          void openExternal(url.toString());
          return null;
        }
      } catch {
        // 解釈できない行き先は、もとの動きにまかせる
      }
      return originalOpen(target, name, features);
    };
    cleanups.push(() => {
      window.open = originalOpen;
    });

    return () => {
      alive = false;
      cleanups.forEach((f) => f());
    };
  }, []);

  return null;
}
