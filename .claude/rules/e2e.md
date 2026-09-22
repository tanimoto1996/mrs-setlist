---
paths:
  - e2e/**
  - playwright.config.ts
  - scripts/e2e-gate.mjs
  - scripts/lib/git-tree.mjs
  - .claude/hooks/**
---

# E2E（Playwright）と push ゲートの規約

- テストは `e2e/*.spec.ts`。共通のフィクスチャ・ロケータは `e2e/fixtures.ts` にまとめる。
  `test` / `expect` は `@playwright/test` からではなく `./fixtures` から import する（安全弁が効くのはそちら）。
- **`/api/predict`（Jev、有料）を本物で叩くテストを書かない。** `fixtures.ts` の `page` は既定で 500 を返して止める。
  成功系は `mockJev(fakePrediction())`、失敗系は `mockJev({ status, error })` で応答を差し替える。
- ページは `ui.open(page)` / `ui.reload(page)` で開く。`page.goto` を直接呼ばない（hydration 待ちが抜けてフレークする）。
- 初期状態は `seed({...})` で localStorage に `Saved` を流し込む（`ui.open` より前に呼ぶ）。
  `Saved` の形や `STORAGE_KEY` は `app/page.tsx` と同じにする。画面側を変えたら fixtures も直す。
- ロケータはロール・アクセシブルネーム（`getByRole` / `getByLabel`）を優先し、CSS クラスは
  `.chip` / `.track` / `.score-num` など `globals.css` の `@layer components` にある安定した名前だけ使う。
  テストのために `data-testid` を増やす前に、`aria-label` を足せないか考える（本番の a11y も良くなる）。
- 曲は `fixtures.ts` の `SONG` に id と表示名を登録して名指しする。`lib/songs.ts` の表記を変えたらここも直す。
- プロジェクトは `desktop`（Desktop Chrome）と `mobile`（Pixel 7）の 2 つ。片方だけのテストは
  `test.skip(!isMobile, ...)` のように `isMobile` で分ける。
- UI（`app/**`）や API（`app/api/**`）を変えたら、対応する spec を追加・更新する。文言を変えたら
  `getByRole(..., { name })` の期待値も追随させる。
- `npm run test:e2e` は `scripts/e2e-gate.mjs` 経由。引数なしで全部通ったときだけ `.claude/tmp/e2e-ok` に
  作業ツリーの tree hash を書き、`git push` 前に hook がそれと HEAD を照合する。
  この仕組みを弱める変更（ゲートのスキップ、印の手書き）はしない。
- テストの説明文（`test("...")`）は日本語。何を保証しているかが一覧で分かる文にする。
