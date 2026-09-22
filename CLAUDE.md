# mrs-setlist

Mrs. GREEN APPLE のライブセトリを「俺 vs Jev（TypeSafe の判断モデル）vs Gemini」で予想して採点する Next.js アプリ。
背景と仕組みの説明は @README.md を読む。Next.js 16 固有の注意は @AGENTS.md（`next dev` が自動生成）。

## コマンド

```bash
npm run dev         # http://localhost:3000（.env.local を自動で読む）
npm run typecheck   # tsc --noEmit。変更後は必ず通す
npm run build       # 本番ビルド。API や設定を触ったら通す
npm run test:e2e    # Playwright E2E をフルで実行。全部通ると push ゲートが開く。実装したら必ず通す
npm run test:e2e:ui # Playwright の UI モード（デバッグ用。ゲートは更新しない）
npm run fetch:setlists  # setlist.fm から直近セトリを取得 → data/setlists.json（SETLISTFM_API_KEY 必須、--refresh で再取得）
npm run build:stats     # data/setlists.json を集計 → lib/song-stats.json（未マッチ曲名を標準出力に出す）
npm run screenshot:setlist -- --in predictions/<date>.json [--engine gemini] [--full]  # 予想 JSON を画面に流し込んで PNG に撮る（API は呼ばない）
```

ユニットテストのフレームワークは無い。ロジック変更は `npm run typecheck` と、必要なら
`node --no-warnings <file>.ts` で直接実行して確認する（Node 22 は TS をそのまま実行できる）。
画面と API の振る舞いは `e2e/` の Playwright で担保する（@docs/e2e.md）。

## 作業の流れ（必ず守る）

**実装 → ドキュメント・作業記録 → typecheck → E2E → commit → push。** 締めは `/ship` スキルで行う。
詳細は @docs/workflow.md。

- 作業記録は `docs/worklog/YYYY-MM-DD-<slug>.md`。何を・なぜ・どう変えたか、確認したこと、残課題を書く。
- 関係するドキュメント（README / CLAUDE.md / docs/ / rules / SKILL.md）を同じ変更で更新する。
- hook が機械的に強制する: 自分が変更した状態で終わろうとすると Stop hook が一度止めて `/ship` を促す。
  E2E を通した内容と HEAD が一致しないと `git push` が止まる。すり抜けようとしない。
- E2E が通らなければ push しない。直して再実行、3 周で通らなければ状況を報告して止まる。

## 構成の要点

- `lib/songs.ts` 曲マスタ（唯一のデータソース）/ `lib/event.ts` 公演の前提 /
  `lib/jev.ts` Jev 呼び出し（rubric・state・toSetlist は Gemini と共用）/ `lib/gemini.ts` Gemini 呼び出し / `lib/scoring.ts` 採点 / `app/api/predict/route.ts` API /
  `app/page.tsx` 画面（1 ファイルのクライアントコンポーネント、状態は localStorage）
- `lib/song-stats.json` は setlist.fm 由来の演奏実績（`scripts/build-song-stats.ts` が生成）。手で編集しない。
  曲名の突合は `lib/song-title.ts` の `normalizeSongTitle()` を両側に当てる。
- `e2e/` Playwright のテスト（`fixtures.ts` が Jev の遮断・seed・共通ロケータ）/ `playwright.config.ts` /
  `scripts/e2e-gate.mjs` E2E ラッパー（push 可の印を書く）/ `.claude/hooks/` 強制用 hook / `docs/` 手順と作業記録
- `SETLISTFM_API_KEY` と `GEMINI_API_KEY`（またはルートの `gemini-api-key` ファイル）も `TYPESAFE_API_KEY` と同じ扱い。中身を読まない・出力しない。
- 詳しい規約は `.claude/rules/` に分けてある。該当ファイルを開くと自動で読み込まれる。

## 絶対に守ること

- **API キーを読まない・出力しない。** `.env.local`・`jev-api-key`・`gemini-api-key` の中身は見ない。
  キーは `TYPESAFE_API_KEY` / `GEMINI_API_KEY` 環境変数経由でサーバー側だけが使う。フロントに渡さない。
- **Jev も Gemini も呼び出しは有料。** `/api/predict` を叩くと全曲ぶん（Jev は約 6 バッチ並列、Gemini は 1 リクエスト）のトークンを消費する。
  動作確認は 1 回にとどめ、ユーザーが頼んでいないのに繰り返さない。`/predict` スキル経由で呼ぶ（`--engine gemini` で Gemini）。
  **E2E と Playwright MCP からは絶対に本物を呼ばない**（E2E は `fixtures.ts` が遮断、MCP では「Jev に予想させる」を押さない）。
- **実装したら必ず `/ship`。** E2E を飛ばした push、テストを消す・`test.skip` で黙らせる、
  `.claude/tmp/` の印を手書きしてゲートをすり抜ける、はやらない。
- 曲データの追加・修正は `/add-song` スキルの手順に従う。id 重複と ALBUM_ORDER 漏れが典型的な事故。
- コメント・UI 文言・コミットメッセージ・テストの説明文は日本語。コード識別子は英語。

## スキル

| コマンド | 用途 |
| --- | --- |
| `/ship` | 実装の締め。作業記録・ドキュメント → typecheck → E2E → commit → push |
| `/add-song` | 曲マスタに曲を追加・修正する |
| `/predict` | ローカル dev サーバー経由で Jev（`--engine gemini` で Gemini）に予想させ `predictions/` に保存 |
| `/score-setlist` | 実セトリを入力して俺・Jev（・Gemini の JSON）を採点 |
| `/tune-jev` | Jev に渡す前提・ガイダンス・rubric を調整し、前後で比較 |
| `/find-skills` | skills.sh からスキルを探して、日本語にして `.claude/skills/` に導入 |
| `/modernize-ui` | 見た目・UI・UX をモダンに、ミセスらしく整えて Web Interface Guidelines で監査 |

## MCP

- `playwright`（`.mcp.json`）: 画面を実際に開いて確認するときに使う。システムの Google Chrome をヘッドレス・
  使い捨てプロファイルで起動する。E2E を書く前に `browser_snapshot` でアクセシビリティツリーを見てロケータを決めると速い。
  使い方と注意は @docs/e2e.md。
