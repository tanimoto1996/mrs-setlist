import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Zen_Kaku_Gothic_New } from "next/font/google";
import "./globals.css";

// 公式サイトと同じ構成: 英字は Plus Jakarta Sans、日本語は Zen Kaku Gothic New。
// フォント変数は @theme 側の --font-latin / --font-body から参照する（名前を分けて循環を避ける）
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["500", "600", "700", "800"], variable: "--font-jakarta" });
const zen = Zen_Kaku_Gothic_New({ subsets: ["latin"], weight: ["400", "500", "700", "900"], variable: "--font-zen" });

export const metadata: Metadata = {
  title: "SHADOWS セトリ予想 — Jev vs 俺",
  description: "Mrs. GREEN APPLE の全曲から、TypeSafe Jev と一緒にセットリストを当てる遊び",
};

export const viewport: Viewport = {
  themeColor: "#a7da20",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={`${jakarta.variable} ${zen.variable}`}>
      <body>{children}</body>
    </html>
  );
}
