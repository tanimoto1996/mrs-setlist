import type { Metadata } from "next";
import { Shippori_Mincho, Zen_Kaku_Gothic_New } from "next/font/google";
import "./globals.css";

const display = Shippori_Mincho({ subsets: ["latin"], weight: ["500", "700", "800"], variable: "--font-display" });
const body = Zen_Kaku_Gothic_New({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-body" });

export const metadata: Metadata = {
  title: "SHADOWS セトリ予想 — Jev vs 俺",
  description: "Mrs. GREEN APPLE の全曲から、TypeSafe Jev と一緒にセットリストを当てる遊び",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
