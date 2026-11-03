import type { Metadata, Viewport } from "next";
import "@fontsource/noto-sans-jp/400.css";
import "@fontsource/noto-sans-jp/500.css";
import "@fontsource/noto-sans-jp/700.css";
import "@fontsource/noto-sans-jp/900.css";
import "./globals.css";
import { NativeBridge } from "@/components/NativeBridge";
import { LoginToast } from "@/components/LoginToast";
import { RefCapture } from "@/components/RefCapture";

export const metadata: Metadata = {
  // 共有したときのカードなどで使う、本番の URL
  metadataBase: new URL("https://yotachat.app"),
  title: "yota｜キャラと話して進める恋愛ストーリー",
  description: "キャラクターと会話しながら物語を進めるチャットノベル。広告なし・登録なしで始められます。",
  applicationName: "yota",
  icons: { icon: "/icon.svg", apple: "/apple-icon.png" },
  appleWebApp: { capable: true, title: "yota", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#0f0f13",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <RefCapture />
        <NativeBridge />
        <LoginToast />
        {children}
      </body>
    </html>
  );
}
