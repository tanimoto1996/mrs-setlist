---
paths:
  - app/**/*.tsx
  - app/globals.css
---

# 画面（app/）の規約

- `app/page.tsx` は `"use client"` の単一コンポーネント。状態は `localStorage` の
  `mga-setlist-oracle:v1` キーに `Saved` 型で保存している。`Saved` の形を変えるときは
  キーのバージョンを上げる（`:v2`）か、読み込み時にマイグレーションを書く。既存ユーザーの予想を壊さない。
- スタイルは Tailwind CSS v4（`@tailwindcss/postcss`）。設定ファイルは無く、テーマは `globals.css` の
  `@theme` で定義する。独自クラス（`cast-sm`, `shadow-title`, `text-dusk` など）も `globals.css` にある。
  新しい色やフォントは `@theme` に追加し、任意の値をクラス名に埋め込まない。
- 文言は日本語。一人称は「俺」、Jev は「Jev」で統一する。
- アクセシビリティ: タブ UI には `role="tablist"` / `aria-selected`、入力には `aria-label` を付ける慣習を維持。
- Next.js 16 の API は学習データと違う可能性がある。迷ったら `node_modules/next/dist/docs/` を読む。
