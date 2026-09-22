# E2E テスト（Playwright）と Playwright MCP

## 何をテストしているか

`e2e/` にあるのは「ユーザーが画面で実際にやること」の確認。ロジックのユニットテストではない。

| ファイル | 保証していること |
| --- | --- |
| `smoke.spec.ts` | ページが開く、公演情報と全曲ライブラリが出る、初期状態、New Album Odds（過去実績と POPS の目安）、Tour Carryover（持ち越し率と前回ツアーから残る曲数の目安、「前回ツアー」フィルタ）、スマホ下部バー、`GET /api/predict` が 405 |
| `my-setlist.spec.ts` | 曲を押して積む / 外す、並べ替え、リロード後も残る（localStorage）、検索・クイックフィルタ、24 曲の上限 |
| `jev.spec.ts` | Jev の予想（**モック**）が slot 順に並ぶ、送信ボディ（`engine: "jev"`）、エラー表示、モックし忘れ時の安全弁 |
| `gemini.spec.ts` | Gemini の予想（**モック**）が Gemini のカードに並び `engine: "gemini"` で呼ぶ、Jev との共通曲数、エラーは Gemini 側だけ、俺 / Jev / Gemini の 3 者採点と引き分け |
| `result.spec.ts` | 実セトリ入力で即採点、点数（`lib/scoring.ts` の式どおり）、勝敗、確認ダイアログ付きのクリア |

デスクトップ（Desktop Chrome）とスマホ幅（Pixel 7）の 2 プロジェクトで同じ spec を回す。

## 動かす

```bash
npm run test:e2e          # フル実行。全部通ると push ゲートが開く（scripts/e2e-gate.mjs）
npm run test:e2e:ui       # UI モード。1 本ずつ実行・タイムトラベルで見る
npm run test:e2e:headed   # ブラウザを表示して実行
npm run test:e2e:report   # 直近の HTML レポートを開く
npx playwright test e2e/jev.spec.ts -g "失敗"   # 絞り込み（push ゲートは更新されない）
```

- `http://localhost:3000` で `npm run dev` が動いていればそれを使う。動いていなければ Playwright が起動する。
  別ポートにしたいときは `E2E_PORT=3100 npm run test:e2e`。
- 失敗すると `test-results/<テスト名>/` に trace・スクリーンショット・`error-context.md` が残る。

### ブラウザについて（macOS 12 の注意）

- ローカルでは **システムの Google Chrome**（`channel: "chrome"`）を使う。Playwright 同梱の Chromium は
  macOS 12（Monterey）にダウンロードできない（`Playwright does not support chromium on mac12`）ため。
  Chrome が無い環境では `npx playwright install chromium` して `E2E_CHANNEL=chromium npm run test:e2e`。
- CI（`CI=1`）では同梱 Chromium を使う。`npx playwright install --with-deps chromium` を先に流す。
- どうしても同梱 Chromium を macOS 12 で使いたい場合は、mac12 対応が残っている Playwright 1.52 系に落とす
  （`npx playwright@1.52.0 install chromium --dry-run` で確認できる）。

## テストを書く

規約は `.claude/rules/e2e.md`（`e2e/` を開くと自動で読み込まれる）。要点:

- `import { test, expect, ui, SONG, ... } from "./fixtures"`。`@playwright/test` から直接 `test` を取らない。
- **Jev と Gemini（どちらも `/api/predict`、engine で切り替え）は絶対に本物を呼ばない**。`fixtures.ts` の `page` が既定で遮断し、テストごとに
  `mockJev(fakePrediction())` / `mockJev({ status: 502, error: "..." })` で応答を決める。
- ページは `ui.open(page)` で開く（`page.goto` を直接呼ばない）。`domcontentloaded` で進んでから
  `<main aria-busy="false">`（hydration 完了）を待つ。リロードも `ui.reload(page)`。
  hydration 前に入力すると React が状態を初期化して消えるので、この待ちがないテストはフレークする。
- 初期状態は `seed({ mine: [...], actual: [...], jev: ... })`。`ui.open(page)` より前に呼ぶ。
- 画面の場所は `ui.library(page)` / `ui.odds(page)` / `ui.mine(page)` / `ui.jev(page)` / `ui.gemini(page)` / `ui.result(page)`、
  曲チップは `ui.chip(page, "Soranji")`（表示名の完全一致）、セトリの行は `ui.tracks(section)`。
- 曲を名指しするときは `SONG` に id と表示名を足す。`lib/songs.ts` を変えたら追随。
- ブラウザで未捕捉の例外が 1 つでも出ると、そのテストは失敗扱いになる（fixtures が `pageerror` を集めている）。

## Playwright MCP（画面を実際に触って確認する）

`.mcp.json` にプロジェクト共有の MCP サーバー `playwright` を定義してある。Claude Code が起動時に読み込み、
`browser_navigate` / `browser_snapshot` / `browser_click` / `browser_take_screenshot` などのツールが使える。

- ブラウザはシステムの Chrome をヘッドレス・使い捨てプロファイル（`--isolated`）で起動する。
- 使いどころ: 実装した見た目の確認、E2E を書く前にアクセシビリティツリー（`browser_snapshot`）を見てロケータを決める、
  E2E で再現しづらい操作の手動確認。
- **MCP からも「Jev に予想させる」「Gemini に予想させる」は押さない**。本物の `/api/predict` に届いて課金される。
- `enableAllProjectMcpServers: true`（`.claude/settings.json`）で、この `.mcp.json` は確認なしで有効になる。
- MCP 側の Playwright が「ブラウザが無い」と言ったら `browser_install` ツールではなく、`--browser chrome` が
  効いているか（`.mcp.json`）を確認する。macOS 12 では同梱 Chromium は入らない。

## 変更したときに直す場所

| 変えたもの | 直すもの |
| --- | --- |
| `app/page.tsx` の文言・構造 | 対応する spec の `getByRole(..., { name })` / `ui` のロケータ |
| `<main aria-busy>` の付け外し | `e2e/fixtures.ts` の `ui.ready`（hydration 待ち） |
| `Saved` の形 / `STORAGE_KEY` | `e2e/fixtures.ts` の `Saved` / `STORAGE_KEY` |
| `lib/event.ts` の `setlistSize` | `e2e/fixtures.ts` の `SETLIST_SIZE` と `FAKE_SETLIST` の曲数 |
| `lib/scoring.ts` の点数 | `e2e/result.spec.ts` の期待値（コメントの計算式も） |
| `lib/songs.ts` の id / 表記 | `e2e/fixtures.ts` の `SONG` / `FAKE_SETLIST` |
