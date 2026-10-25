import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "yota — 推しと紡ぐ物語",
  description: "AIのキャラクターと、あなただけの物語を。返事はすぐ、広告はなし。",
  applicationName: "yota",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  appleWebApp: { capable: true, title: "yota", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#1b1630",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
