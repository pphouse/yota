import type { CapacitorConfig } from "@capacitor/cli";

/**
 * iOS / Android アプリの設定。
 * アプリは本番の yotachat.app を読み込む（API を持つ Next.js なので、静的な書き出しはしない）。
 * Web を直せばアプリにもそのまま反映される。共有・通知・戻るボタン・外部リンクはネイティブで動かす（src/lib/native.ts）。
 *
 * 開発中に手元のサーバーを読み込むときは CAP_SERVER_URL=http://<PCのIP>:3000 npx cap sync
 */
const serverUrl = process.env.CAP_SERVER_URL ?? "https://yotachat.app";

const config: CapacitorConfig = {
  // ストアに一度出すと変えられない。yotachat.app を逆にしたもの
  appId: "app.yotachat",
  appName: "yota",
  // 本番に繋がらないときだけ出す画面（native/www/index.html）
  webDir: "native/www",
  backgroundColor: "#0f0f13",
  // サーバー側でアプリからのアクセスを見分けるための印（User-Agent の末尾に付く）
  appendUserAgent: "YotaApp",
  server: {
    url: serverUrl,
    cleartext: serverUrl.startsWith("http://"),
    // アプリの中で開いてよい場所。X・LINE・Apple のログインの画面もアプリの中で開く（ログインの cookie をアプリに残すため）。
    // Google はアプリの中の画面でのログインを受け付けないので、アプリでは Google のボタンを出さない（LoginSheet）
    allowNavigation: ["yotachat.app", "x.com", "*.x.com", "twitter.com", "*.twitter.com", "access.line.me", "*.line.me", "appleid.apple.com", "*.apple.com"],
    errorPath: "index.html",
  },
  ios: {
    contentInset: "never",
    limitsNavigationsToAppBoundDomains: false,
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      // 最初の画面が描けたら NativeBridge が閉じる
      launchAutoHide: false,
      launchFadeOutDuration: 200,
      backgroundColor: "#0f0f13",
      showSpinner: false,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
