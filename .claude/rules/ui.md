---
paths:
  - app/**/*.tsx
  - app/globals.css
---

# 画面（app/）の規約

- `app/page.tsx` は `"use client"` の単一コンポーネント。状態は `localStorage` の
  `mga-setlist-oracle:v1` キーに `Saved` 型で保存している。`Saved` の形を変えるときは
  キーのバージョンを上げる（`:v2`）か、読み込み時にマイグレーションを書く。既存ユーザーの予想を壊さない。
  （`gemini` は v1 のまま後から足したキー。`{ ...EMPTY, ...parsed }` のマージで null に埋まるので移行不要）
- スタイルは Tailwind CSS v4（`@tailwindcss/postcss`）。設定ファイルは無く、テーマは `globals.css` の
  `@theme` で定義する。色トークンは公式サイト準拠: `deep` / `forest` / `green` / `lime` / `lime-light` / `cream` /
  `mint` / `teal` / `fog` / `line` / `dusk` / `rouge`（+ 点用の `lilac` / `sky` / `orange` / `aqua`、Gemini 表示用の `cobalt`）。
  新しい色やフォントは `@theme` に追加し、任意の値をクラス名に埋め込まない。
- フォントは `layout.tsx` の next/font が `--font-jakarta` / `--font-zen` を出し、
  `@theme` の `--font-latin` / `--font-body` がそれを参照する（同名にすると循環するので分けている）。
- 独自クラスは `globals.css` の `@layer components` にある: `band-lime` / `band-fog`（帯）, `latin`, `section-title`,
  `kicker`, `poster`, `wordmark`, `card`, `chip` / `chip-on` / `chip-num` / `chip-meta`（Jev の %）/ `chip-meta-alt`（Gemini の %）, `tag-new`, `seg`, `field`,
  `btn-primary` / `btn-lime` / `btn-ghost` / `icon-btn`, `bar` / `bar-fill`, `track` / `track-hit` / `track-miss`,
  `slot-label`, `score-num` / `score-win`, `rail`, `dock`（スマホ下部バー）, `rise`（`--i` で順送りリビール）。
  増やしたらこの一覧も更新する。
- デザインの方向性と「ミセスらしさ」の定義は `.claude/skills/modernize-ui/reference/brand.md`。
  見た目を大きく変えるときは `/modernize-ui` を通す。
- 文言は日本語。一人称は「俺」、Jev は「Jev」、Gemini は「Gemini」で統一する。
- rail の先頭にある New Album Odds（`odds-heading`、`NewAlbumOdds` コンポーネント）は `lib/album-stats.ts` の数字を
  そのまま出す。Jev の state と同じ値なので、画面側で丸め方や計算を変えない（変えるなら `lib/album-stats.ts`）。
  手入力（`source: "manual"`）の実績行には出典リンク（`aria-label="<アルバム> 初日セトリの出典"`）を必ず出す。
- その下の Tour Carryover（`carryover-heading`、`TourCarryover` コンポーネント）は `lib/tour-stats.ts` の数字をそのまま出す
  （目安は `projectCarriedSongs()`）。Library のクイックフィルタ「前回ツアー」も同じ JSON の `songs[].playedIn[0]` を見る。
  画面側で丸め方や計算を変えない（変えるなら `lib/tour-stats.ts`）。
- 予想カードは Jev（`jev-heading`）と Gemini（`gemini-heading`）で同じ構成（見出し・ボタン・アラート・`SetlistView`・モデル名とトークン）。
  片方だけ変えない。`Saved.jev` / `Saved.gemini` は同じ `PredictionResult` 型で、`ask(engine)` が `/api/predict` に `engine` を付けて呼ぶ。
- アクセシビリティ: タブ UI には `role="tablist"` / `aria-selected`、トグルには `aria-pressed`、
  アイコンだけのボタンには `aria-label`、進捗には `role="progressbar"` を付ける慣習を維持。
  `prefers-reduced-motion: reduce` で transform 系アニメーションを止める。
- `<main aria-busy={!hydrated}>` は localStorage を読み戻すまで true。E2E の `ui.open`（`e2e/fixtures.ts`）が
  これが false になるのを待ってから操作するので、外したり別の要素に移したりしない（移すなら fixtures も直す）。
- Next.js 16 の API は学習データと違う可能性がある。迷ったら `node_modules/next/dist/docs/` を読む。
