# mrs-setlist

Mrs. GREEN APPLE のライブセトリを「俺 vs Jev（TypeSafe の判断モデル）」で予想して採点する Next.js アプリ。
背景と仕組みの説明は @README.md を読む。Next.js 16 固有の注意は @AGENTS.md（`next dev` が自動生成）。

## コマンド

```bash
npm run dev         # http://localhost:3000（.env.local を自動で読む）
npm run typecheck   # tsc --noEmit。変更後は必ず通す
npm run build       # 本番ビルド。API や設定を触ったら通す
npm run fetch:setlists  # setlist.fm から直近セトリを取得 → data/setlists.json（SETLISTFM_API_KEY 必須、--refresh で再取得）
npm run build:stats     # data/setlists.json を集計 → lib/song-stats.json（未マッチ曲名を標準出力に出す）
```

テストフレームワークは無い。ロジック変更は `npm run typecheck` と、必要なら
`node --no-warnings <file>.ts` で直接実行して確認する（Node 22 は TS をそのまま実行できる）。

## 構成の要点

- `lib/songs.ts` 曲マスタ（唯一のデータソース）/ `lib/event.ts` 公演の前提 /
  `lib/jev.ts` Jev 呼び出し / `lib/scoring.ts` 採点 / `app/api/predict/route.ts` API /
  `app/page.tsx` 画面（1 ファイルのクライアントコンポーネント、状態は localStorage）
- `lib/song-stats.json` は setlist.fm 由来の演奏実績（`scripts/build-song-stats.ts` が生成）。手で編集しない。
  曲名の突合は `lib/song-title.ts` の `normalizeSongTitle()` を両側に当てる。
- `SETLISTFM_API_KEY` も `TYPESAFE_API_KEY` と同じ扱い。中身を読まない・出力しない。
- 詳しい規約は `.claude/rules/` に分けてある。該当ファイルを開くと自動で読み込まれる。

## 絶対に守ること

- **API キーを読まない・出力しない。** `.env.local` と `jev-api-key` の中身は見ない。
  キーは `TYPESAFE_API_KEY` 環境変数経由でサーバー側だけが使う。フロントに渡さない。
- **Jev の呼び出しは有料。** `/api/predict` を叩くと全曲ぶん（約 6 バッチ並列）のトークンを消費する。
  動作確認は 1 回にとどめ、ユーザーが頼んでいないのに繰り返さない。`/predict` スキル経由で呼ぶ。
- 曲データの追加・修正は `/add-song` スキルの手順に従う。id 重複と ALBUM_ORDER 漏れが典型的な事故。
- コメント・UI 文言・コミットメッセージは日本語。コード識別子は英語。

## スキル

| コマンド | 用途 |
| --- | --- |
| `/add-song` | 曲マスタに曲を追加・修正する |
| `/predict` | ローカル dev サーバー経由で Jev に予想させ `predictions/` に保存 |
| `/score-setlist` | 実セトリを入力して俺・Jev を採点 |
| `/tune-jev` | Jev に渡す前提・ガイダンス・rubric を調整し、前後で比較 |
