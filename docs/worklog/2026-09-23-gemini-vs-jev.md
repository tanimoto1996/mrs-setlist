# Gemini を第 2 の予想エンジンとして追加し、Jev と同じ画面で比べられるようにする

- 日付: 2026-09-23
- 依頼 / 目的: 「今回の Jev で検索したセトリを画像に撮ってプロジェクトルート以下に保存しておいて。
  今回は Jev の精度を知りたいので、Gemini API ではどのような結果になるかも知りたい。この画面で出せるようにしてほしい。
  API キーは gemini-api-key として登録した」

## やったこと

- **Gemini 連携** `lib/gemini.ts`: Jev と同じ `buildState()`（公演の前提・曲メタデータ・演奏実績・guidance）と
  同じ 4 段階 rubric / slot 選択肢を、Gemini の `generateContent` に全曲 1 リクエストで渡す。
  `responseJsonSchema` で `{ songs: [{ songId, play, confidence, slot }] }` の形を強制し、
  `PredictionResult`（Jev と同じ型）に正規化して返す。既定モデルは `gemini-3.8-flash`（`GEMINI_MODEL` で変更可）。
- **キーの扱い**: `GEMINI_API_KEY` 環境変数を優先し、無ければプロジェクトルートの `gemini-api-key` ファイルを読む。
  どちらも fetch のヘッダーに載せるだけで、ログ・エラー・応答に出さない。`.claude/settings.json` の deny に
  `gemini-api-key` を追加。
- **API** `app/api/predict/route.ts`: ボディに `engine: "jev" | "gemini"` を追加（省略時 jev）。キー未設定・不正な engine は
  それぞれ `{ error }` で返す。
- **画面** `app/page.tsx`: 「Gemini's Call」カードを Jev の下に追加。匂わせメモは Jev と共通。Library のチップに
  Jev（緑）と Gemini（青 `chip-meta-alt`）の見込み % を並べ、凡例を出す。Result は俺 / Jev / Gemini の 3 者採点にし、
  最高点が 1 人なら「○の勝ち」、並べば「引き分け」。Gemini カードには Jev との共通曲数も出す。
  各カードに「JSON を保存」ボタンを追加（予想を `PredictionResult` の JSON でダウンロード）。
  `Saved` に `gemini` を足したが、`STORAGE_KEY` は v1 のまま（読み込み時に `EMPTY` とマージするので既存の Jev 予想は消えない）。
- **スクリーンショット** `scripts/screenshot-setlist.ts`（`npm run screenshot:setlist`）: 保存済みの予想 JSON を
  localStorage に流し込んで画面を描画し、予想カード（または `--full` でページ全体）を PNG に撮る。API は呼ばない。
- **/predict スキル**: `--engine gemini` を追加。既定の保存名は Jev が `predictions/<日付>.json`、Gemini が `predictions/<日付>-gemini.json`。
- **E2E**: `e2e/gemini.spec.ts`（5 本）を追加。Jev の spec は送信ボディに `engine: "jev"` が付く期待値に更新。
  `fixtures.ts` の `Saved` / `seed` / `fakePrediction(model)` / `ui.gemini` を追随。
- ドキュメント: `README.md` / `CLAUDE.md` / `.claude/rules/jev.md` / `.claude/rules/ui.md` / `docs/e2e.md` / `.env.example`。

## 判断したこと・理由

- **Gemini には「state を主に、自身の知識は補助的に」と指示**: Jev は判断モデルで state しか持たないが、Gemini は
  ミセスの曲やライブの知識を持っている。完全に知識を封じると「Gemini ならどうなるか」という問いの答えにならないので、
  state 優先・知識は補助の位置づけにした。厳密に同条件で比べたければ `lib/gemini.ts` の `SYSTEM_INSTRUCTION` を変える。
- **全曲 1 リクエスト**: Gemini は長い入力を扱えるので、Jev のような 20 曲バッチにしない。出力は 1 曲 40 トークン前後 × 100 曲強で
  `maxOutputTokens: 16384` に収まる。応答が切れた場合は `finishReason` 付きのエラーを返す。
- **同じ `/api/predict` に engine を足す**（別ルートにしない）: E2E の安全弁（`fixtures.ts` が `**/api/predict` を遮断）が
  Gemini にもそのまま効く。有料 API を E2E から呼ばない保証を 1 か所で保てる。
- **`STORAGE_KEY` を v2 にしない**: ユーザーのブラウザに残っている今回の Jev 予想を消さないため。追加キーだけなので
  `{ ...EMPTY, ...parsed }` のマージで足りる。
- **3 者採点の勝敗**: 予想がある参加者が 2 人以上いるときだけ判定。最高点が並んだら引き分け。
  Gemini のスコアカードは Gemini の予想があるときだけ出す（既存テストの `.score-num` 2 枚を壊さない）。
- **既存の Jev 結果の画像化は未完**: 今回の Jev 予想はユーザーのブラウザ（Chrome）の localStorage にしか無く、
  `predictions/` に JSON は無かった。Chrome のプロファイルを直接読むのは権限で止められた（正しい判断だと思う）。
  代わりに「JSON を保存」ボタンと `screenshot:setlist` を用意し、ボタンで落とした JSON を `predictions/` に置いて
  スクリプトを回せば画像になる手順にした。

## 確認したこと

- `npm run typecheck` 通過。
- `scripts/screenshot-setlist.ts` をダミーの予想 JSON で実行し、Jev カード単体と Gemini ページ全体の PNG が撮れることを確認
  （出力はセッションの scratchpad。`predictions/` には置いていない）。
- `npm run test:e2e`（引数なし・フル）: **38 本通過・2 本 skip（幅で片方だけのテスト）、4.8 分**。desktop 20 + mobile 20。
  作業記録を書いた後にもう一度フルで回し、その tree で push している。
- Gemini の本物呼び出しは、`gemini-api-key` ファイルが 0 バイトだったため未確認（キー未設定エラーの経路のみ確認）。

## 残課題・引き継ぎ

- **`gemini-api-key` が空**（0 バイト）。ファイルにキーを 1 行書くか、`.env.local` に `GEMINI_API_KEY=` を足して
  `npm run dev` を再起動すると「Gemini に予想させる」が動く。
- 今回の Jev 予想の画像: 画面の Jev's Call にある「JSON を保存」→ `predictions/2026-09-23.json` に置く →
  `npm run screenshot:setlist -- --in predictions/2026-09-23.json --out predictions/2026-09-23-jev.png`。
- `responseJsonSchema` を Gemini が受け付けない場合（モデルや API 版の違い）は、`generationConfig.responseSchema` に
  切り替える。エラー本文はそのまま画面のアラートに出る。
- Gemini の思考トークン（`thoughtsTokenCount`）は out に合算している。コストを見るなら分けてもよい。

## 追記（同日）: Gemini の結果で slot 見出しが重複した

- 症状: Gemini の予想を表示すると React が `slot-middle` / `slot-skip` の key 重複を警告し、Middle と Others の見出しが交互に出た。
- 原因: `toSetlist()` は skip を middle 扱いで並べるが、`SetlistView` は元の slot で見出しを切っていた。Gemini は
  play が高いのに slot=skip を返す曲が Jev より多く、上位 24 曲の中で middle と skip が混ざった。
- 対処: `SetlistView` の見出し判定も skip を middle 扱いにし、key に行番号を含めた。あわせて Gemini への指示に
  「slot=skip なら play は 0 か 1、play=3 なら opener / middle / encore のどれか」と矛盾禁止を足した。
