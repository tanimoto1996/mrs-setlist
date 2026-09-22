---
name: modernize-ui
description: app/ の見た目・UI・UX をモダンに、かつ Mrs. GREEN APPLE らしく整える。「見た目を整えて」「モダンにして」「ミセスっぽく」「UI をレビューして」「アクセシビリティ見て」と言われたときに使う。デザイン方針の決定 → 実装 → Web Interface Guidelines での監査、までを一気にやる。
argument-hint: [対象ファイル or 直したい箇所（例: app/page.tsx のスコアカード）]
allowed-tools: Read, Edit, Write, Glob, Grep, WebFetch, Bash(npm run typecheck), Bash(npm run build), Bash(npm run dev*), Bash(curl -s *)
---

# UI をモダンに、ミセスらしく整える

対象: $ARGUMENTS

元ネタは skills.sh で最上位の 2 つを合わせたもの。

- [anthropics/skills@frontend-design](https://skills.sh/anthropics/skills/frontend-design) … 「AI っぽい没個性」を避け、
  方向性を決めて振り切る美的ガイド
- [vercel-labs/agent-skills@web-design-guidelines](https://skills.sh/vercel-labs/agent-skills/web-design-guidelines) …
  Web Interface Guidelines に沿った UI/UX・アクセシビリティの監査

ブランドの方向性は `reference/brand.md`（ミセスらしさの定義）を必ず先に読む。

## 1. 方向性を決める（コードを書く前に）

次を 1 行ずつ書き出してから着手する。迷ったまま手を動かさない。

- **目的**: この画面は誰が何のために触るか（ここでは「ファンがライブ前にセトリを組んで、Jev と競う」）
- **トーン**: 1 つに振り切る。このプロジェクトは公式サイト準拠（明るいライム × 白カード × 深緑）で固定。`reference/brand.md` を読む
- **制約**: Next.js 16 / Tailwind v4 / `@theme` トークン / `.claude/rules/ui.md` の規約 / localStorage の `Saved` 形は壊さない
- **記憶に残る 1 点**: 何を見た瞬間に「ミセスのやつだ」と分かるか（例: ライムのグラデの帯に深緑のポスター）

## 2. 実装のルール

### タイポグラフィ

- 英字は Plus Jakarta Sans（`--font-latin` / `.latin`）、日本語は Zen Kaku Gothic New（`--font-body`）。公式と同じ構成。
- セクション見出しは英字（Library / My Setlist / Result）を `.section-title` で大きく、日本語は下に小さく添える。
- 数字（スコア、曲数、%）は `tabular-nums`。番号は `.track-num` / `.chip-num` のティールの丸に入れる。
- 小さなカテゴリラベルは `.kicker`（ティール、大文字、字間広め）。

### 色・質感

- 色は必ず `app/globals.css` の `@theme` に置く。クラス名に生の色コードを埋め込まない。
- 地はライムのグラデ（`.band-lime`）かグレー（`.band-fog`）。その上に白の丸角カード（`.card`、radius 10px）を置く。
- 文字とボタンは深緑 `deep` / `forest`。緑を文字色に使わない。強調はティール `teal` の点で。
- 暗いテーマ・明朝・装飾的な影・ガラス質パネルはやらない（公式の清潔感から外れる）。

### モーション

- 初回表示の順送りリビール（`animation-delay` をずらす）を 1 回だけ。細かい動きをバラバラに散らすより効く。
- hover / pressed / focus は 120〜200ms。`prefers-reduced-motion: reduce` では transform 系を止める。
- ローディングは進行が分かる形（シマー、割合表示）。ただの「…」で済ませない。

### レイアウト

- 対称に並べ切らない。見出しを大きく置いて余白を作る、右カラムを sticky にする、など主従をはっきり。
- モバイルは 1 カラム、`lg:` 以上で 2 カラム。タップ領域は 40px 以上。
- 空状態・エラー・ローディング・完了、の 4 状態を全部デザインする。

### 守ること（`.claude/rules/ui.md`）

- `app/page.tsx` は `"use client"` の単一コンポーネント。`Saved` の形とキー `mga-setlist-oracle:v1` を変えない。
- 文言は日本語。一人称は「俺」、Jev は「Jev」。
- `role="tablist"` / `aria-selected` / `aria-pressed` / `aria-label` の慣習を維持。
- 独自クラスは `globals.css` の `@layer components` に置き、`ui.md` の一覧を更新する。

## 3. 監査する（実装後）

Web Interface Guidelines の最新ルールを取得して、変更したファイルを機械的に見直す。

```
WebFetch https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md
```

取得したルールを対象ファイル（既定: `app/page.tsx`, `app/globals.css`, `app/layout.tsx`）に当て、
`file:line` 形式で指摘を列挙して直す。特に見るのは:

- フォーカスリングが見える / `:focus-visible` を消していない
- コントラスト（薄い文字は 4.5:1 を切っていないか）
- `button` に `type` と到達可能なラベル、アイコンだけのボタンに `aria-label`
- フォームの `label` 紐付け、`placeholder` をラベル代わりにしない
- `prefers-reduced-motion` 対応、`scroll-margin` / sticky の重なり
- 数字の `tabular-nums`、日本語の禁則（`text-wrap: balance` / `pretty`）

## 4. 確認して報告

```bash
npm run typecheck
npm run build
```

両方通したうえで、「方向性 1 行」「変えた点（見た目 / UX / a11y）」「監査で直した指摘」を箇条書きで報告する。
Jev の API（`/api/predict`）は有料なので、見た目確認のために叩かない。
