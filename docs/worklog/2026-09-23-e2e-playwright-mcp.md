# Playwright MCP の導入、E2E テストの整備、「実装 → E2E → push」フローの強制

- 日付: 2026-09-23
- 依頼 / 目的: 「mcp のプレイライトを入れて、E2E テストを導入して、実装したら必ず E2E テストするようなフローにしてほしい。
  この実装をするときに必ずドキュメント・作業内容を追加してほしい。実装が終わったら必ず E2E → OK なら push するような流れにして」

## やったこと

- **Playwright MCP**: `.mcp.json` にプロジェクト共有の `playwright` サーバー（`@playwright/mcp@0.0.82`、
  ヘッドレス・使い捨てプロファイル・システム Chrome）を追加。`.claude/settings.json` で `enableAllProjectMcpServers: true`。
- **E2E テスト**: `@playwright/test` 1.63 を導入し、`e2e/` に 4 spec・14 テスト（× desktop / mobile の 2 プロジェクト = 28 ケース）。
  `e2e/fixtures.ts` に「`/api/predict` を絶対に本物で呼ばない」安全弁、localStorage の seed、Jev のモック、共通ロケータを集約。
- **push ゲート**: `npm run test:e2e` を `scripts/e2e-gate.mjs` 経由にし、引数なしで全部通ったときだけ
  作業ツリーの tree hash を `.claude/tmp/e2e-ok` に記録。`git push` 前に hook が `HEAD^{tree}` と照合する。
- **hooks**（`.claude/hooks/`、Node 製）: `pre-bash.mjs`（push ゲート + 実行前 tree の控え）、
  `post-tool.mjs`（このセッションで触った印）、`stop-gate.mjs`（未 push のまま終わろうとしたら一度だけ止めて `/ship` を促す）。
- **スキル `/ship`**: ドキュメント・作業記録 → typecheck → E2E → commit → push の手順書。
- **規約 `.claude/rules/e2e.md`**: `e2e/` や hook を開くと自動で読まれる。
- **ドキュメント**: `docs/workflow.md`（フロー全体と worklog テンプレ）、`docs/e2e.md`（テストの中身・動かし方・MCP）、
  `README.md` / `CLAUDE.md` の更新。
- `.gitignore` に Playwright の成果物、`package.json` に `test:e2e*` スクリプトを追加。

## 判断したこと・理由

- **ブラウザはシステムの Google Chrome（`channel: "chrome"`）**: この Mac は macOS 12.7 で、Playwright 1.63 の同梱 Chromium は
  ダウンロードを拒否される（`does not support chromium on mac12`）。Chrome 150 が入っていたのでそれを使う。
  CI では同梱 Chromium に切り替わる（`process.env.CI`）。Playwright を 1.52 に落とす案は、MCP 側の Playwright と
  食い違うのでやめた。
- **ゲートの照合は tree hash**: 「E2E を通したファイル内容」と「push するコミットの内容」を比べたい。時刻や
  コミット SHA だと「E2E の後に 1 行直してコミットし直した」を検知できない。`GIT_INDEX_FILE` に一時 index を使い、
  本物の index には触らない。
- **Stop hook は一度だけ止める**: `stop_hook_active` を見て 2 回目は通す。E2E がどうしても通らないときに
  無限に止まらないため。ユーザー自身の未コミット変更（Claude が触っていない）では止めない。
- **E2E は dev サーバーを再利用**: 3000 で動いていればそれを使う。`next dev` の初回コンパイルを毎回待たないため。
- **hook は Node（.mjs）**: この Mac に `jq` が無く、Node 22 は必ずある。
- **E2E の `goto` / `reload` は `domcontentloaded` 待ち**（`ui.open` / `ui.reload`）: next dev では `load` イベントが
  フォントのサブセット（数十の woff2 プリロード）完了まで約 3 秒待たされ、1 テスト 10〜30 秒・スイート全体 5 分になっていた。
  DOM 完成は 0.8 秒なので、そこで先へ進み、要素の出現は各 `expect` に待たせる。
- **セトリの並びは `ui.expectTracks` で検証**: リロード直後に `allInnerTexts()`（リトライしない）で読むと
  hydration 前の空リストを掴んで落ちた。件数が揃うまで `toHaveCount` で待ってから読む。
- **タイムアウト**: テスト 90 秒 / expect 15 秒 / 遷移 45 秒。dev サーバー相手で 2 ワーカー並列でも余裕がある値。

## 確認したこと

- `npm run typecheck` 通過（`e2e/` も `tsconfig` の `include` に入るので型検査対象）。
- `npm run test:e2e`: 5 回目で **28 本すべて通過（desktop 14 + mobile 14、幅で片方だけのテスト 2 本は skip）、3.3 分**。
  push 前のゲート実行はこの内容のまま（作業記録を書いた後に）もう一度フルで回している。
- E2E の経過: 1〜2 回目はブラウザ未取得で全滅（macOS 12 の制約）→ Chrome channel に切り替えた 3 回目は 25/28 通過・
  約 5 分。落ちた 3 本はリロード直後の読み取りタイミング。`expectTracks` と `domcontentloaded` 待ちに直して 4 回目以降は全通過。
- hook は合成 stdin で 7 ケース手動検証: 通常 Bash で tree を控える / 変化のない Bash では touched を立てない /
  Edit で touched を立てる / Stop で block JSON を返す / `stop_hook_active` で素通り /
  push は「印なし」「印が HEAD と不一致」で exit 2、「一致」で exit 0。

## 残課題・引き継ぎ

- `.claude/settings.json` の `hooks` は反映済み（Bash 経由と最初の Edit は自動モードの分類器に「自己変更」として
  止められたが、`update-config` スキルの手順で hook を単体検証してから Edit したら通った）。
- hook は Claude Code 起動時に読み込まれるため、この作業をしたセッションでは効いていない。次のセッションから有効。
  すぐ効かせたいときは `/hooks` を一度開くか、Claude Code を起動し直す。
- この Mac では 1 テスト 10〜30 秒、フルで 3 分強かかる。速くしたければ `workers` を増やすより、
  dev サーバーではなく `next build && next start` を webServer にする案が有力（未検証）。
- Stop hook は settings.json を書いた直後のこのセッションでも発火した（設定ファイルの監視で読み直された）。
- push ゲートの初版はコマンド文字列全体に `git push` の正規表現を当てていて、コミットメッセージ本文に
  「git push 前に…」と書いただけで `git commit` が止まった。コマンド先頭か `;` `&&` `||` `|` 直後の
  `git push` だけを見るように直した（引用符の中までは追わない。誤検知側に倒れる分には安全）。
- CI（GitHub Actions）はまだ無い。入れるなら `npx playwright install --with-deps chromium` → `npm run test:e2e`。
- `@playwright/mcp` は 0.0.82 に固定。上げるときは `.mcp.json` の版を変えて `docs/e2e.md` を更新。
