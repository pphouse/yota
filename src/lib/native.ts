"use client";

/**
 * iOS / Android アプリ（Capacitor）の中で動いているときだけ使う、ネイティブの機能。
 * ブラウザで開いたときは何もしないか、Web の方法にまかせる。
 * プラグインは使うときに読み込む（ブラウザで開く人の読み込みを重くしないため）。
 */

type CapacitorGlobal = { isNativePlatform?: () => boolean; getPlatform?: () => string };

function cap(): CapacitorGlobal | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
}

/** アプリの中で動いているか */
export function isNativeApp(): boolean {
  return cap()?.isNativePlatform?.() ?? false;
}

/** "ios" | "android" | "web" */
export function nativePlatform(): string {
  return cap()?.getPlatform?.() ?? "web";
}

/** yota の外のページは、アプリの中ではなく端末のブラウザ（アプリ内ブラウザ）で開く */
export async function openExternal(url: string): Promise<void> {
  if (!isNativeApp()) {
    window.open(url, "_blank", "noopener");
    return;
  }
  const { Browser } = await import("@capacitor/browser");
  await Browser.open({ url, presentationStyle: "popover" });
}

/** 文章とリンクを、端末の共有シートで共有する。共有できなかったら false */
export async function shareLink(opts: { title?: string; text?: string; url: string }): Promise<boolean> {
  if (isNativeApp()) {
    const { Share } = await import("@capacitor/share");
    try {
      await Share.share({ title: opts.title, text: opts.text, url: opts.url, dialogTitle: "共有する" });
      return true;
    } catch {
      return false; // 共有シートを閉じただけ
    }
  }
  if (!navigator.share) return false;
  try {
    await navigator.share(opts);
    return true;
  } catch {
    return false;
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",", 2)[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * 画像を、端末の共有シートで共有する（アプリの中だけ）。
 * いったんアプリのキャッシュに書き出してから渡す。共有シートには「画像を保存」も出る。
 */
export async function shareImageNative(blob: Blob, fileName: string, text: string): Promise<boolean> {
  if (!isNativeApp()) return false;
  const [{ Filesystem, Directory }, { Share }] = await Promise.all([import("@capacitor/filesystem"), import("@capacitor/share")]);
  const written = await Filesystem.writeFile({ path: fileName, data: await blobToBase64(blob), directory: Directory.Cache });
  try {
    await Share.share({ text, files: [written.uri], dialogTitle: "共有する" });
    return true;
  } catch {
    return false;
  }
}

/**
 * 通知が使えるか。Firebase（Android）と APNs（iOS）の設定を入れるまでは false にしておく。
 * 設定がないまま Android で通知を登録すると、アプリが落ちるため。
 */
export function pushAvailable(): boolean {
  return isNativeApp() && process.env.NEXT_PUBLIC_PUSH_ENABLED === "1";
}

/**
 * 通知を受け取る許可をもらい、端末のトークンをサーバーに登録する（アプリの中だけ）。
 * 起動直後には聞かず、設定画面などで本人が選んだときに呼ぶ。
 */
export async function enablePush(): Promise<"granted" | "denied" | "unsupported"> {
  if (!pushAvailable()) return "unsupported";
  const { PushNotifications } = await import("@capacitor/push-notifications");
  let perm = await PushNotifications.checkPermissions();
  if (perm.receive === "prompt" || perm.receive === "prompt-with-rationale") perm = await PushNotifications.requestPermissions();
  if (perm.receive !== "granted") return "denied";
  await new Promise<void>((resolve) => {
    void PushNotifications.addListener("registration", async ({ value }) => {
      await fetch("/api/push", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: value, platform: nativePlatform() }),
      }).catch(() => {});
      resolve();
    });
    void PushNotifications.addListener("registrationError", () => resolve());
    void PushNotifications.register();
  });
  return "granted";
}

/** 通知の許可の状態（設定画面の表示用） */
export async function pushPermission(): Promise<"granted" | "denied" | "prompt" | "unsupported"> {
  if (!pushAvailable()) return "unsupported";
  const { PushNotifications } = await import("@capacitor/push-notifications");
  const p = await PushNotifications.checkPermissions();
  return p.receive === "granted" ? "granted" : p.receive === "denied" ? "denied" : "prompt";
}
