---
paths:
  - lib/jev.ts
  - lib/gemini.ts
  - lib/event.ts
  - app/api/**
---

# Jev / Gemini 連携（lib/jev.ts, lib/gemini.ts, lib/event.ts, app/api/**）の規約

- Jev は知識モデルではなく判断モデル。曲の知識は持っていない前提で、判断材料は
  `buildState()` に詰めたメタデータと `guidance`、`event.facts`、`rumors` だけ。予想の質はここで決まる。
- 「新アルバム曲は何曲入るか」は感覚ではなく数字で渡す。`event.newAlbum`（POPS）と `lib/album-debut-stats.json` から
  `buildNewAlbumHistory()` が `state.newAlbumHistory`（過去実績・目安曲数・先行シングル / アルバム初出の内訳）を作り、
  guidance の先頭 2 行もそこから生成する。`songs[].albumTrackType` は新アルバム曲だけ `pre-released` / `album-only`。
  目安は「直近の ANTENNA の比率 × 曲数」〜「過去 5 枚の平均 × 曲数」のレンジ（`projectNewAlbumSongs()`）。
  目安を変えたいときは guidance の文言を直すか、`scripts/build-album-debut-stats.ts` のルール
  （120 日 / 15 曲）や `data/manual-setlists.json` の公演を見直して再集計する。JSON を手で書き換えない。
- 「前回のツアーの曲はどれだけ残るか」も数字で渡す。`lib/tour-stats.json` から `buildTourHistory()` が `state.tourHistory`
  （直近ツアーの凡例・連続ツアー間の持ち越し率・連続回数別の残り方・前回ツアーから残る曲数の目安・前回の FC 限定ツアー）を作り、
  guidance の 3 行（持ち越し率と目安 / 連続している曲は残りやすい / FC ツアーは定番の外が入りやすい）もそこから生成する。
  `songs[].recentTours` は曲ごとの直近 5 ツアーでの `playedIn`（新しい順）・`streak`・`toursSinceLastPlayed`。
  ツアーのまとめ方（15 曲 / 45 日）や名称・FC 限定フラグを変えるなら `scripts/build-tour-stats.ts` / `lib/tours.ts` を直して
  `npm run build:tour-stats`。JSON を手で書き換えない。
- `@typesafe-ai/sdk` の `TypeSafeClient` は `TYPESAFE_API_KEY`（と任意で `TYPESAFE_BASE_URL`）を
  環境変数から読む。コードにキーを書かない。`import "server-only"` を外さない。
- `lib/gemini.ts` は Gemini を同じ物差しで走らせる比較用。`buildState()` / `PLAY_LEVELS` / `SLOT_OPTIONS` / `toSetlist()` を
  `lib/jev.ts` から import して使い、独自の前提や rubric を持たせない（差が出たときに「材料の差」か「モデルの差」か切り分けるため）。
  Gemini への指示（`SYSTEM_INSTRUCTION`）は「state を主に、自身の知識は補助」。変えるときは worklog に理由を書く。
- Gemini のキーは `GEMINI_API_KEY` 環境変数か、ルートの `gemini-api-key` ファイル（`getGeminiApiKey()`）。
  ファイルの中身を読む・出力するコードを増やさない。モデルは `GEMINI_MODEL`（カンマ区切りの候補列。既定は `DEFAULT_GEMINI_MODELS`）。
  503 / 429 のときだけ次の候補へ移る。同じモデルを叩き直すリトライは入れない。
- 質問は `score()`（4 段階 rubric、0 始まり）と `choice()`（`SLOT_OPTIONS`）の 2 種類。
  rubric の段階数を変えたら `likelihood` の正規化（`play.score / maxLevel`）も追随させる。
- `SLOT_OPTIONS` に選択肢を足すときは `Slot` 型・`SLOT_ORDER`・`page.tsx` の表示も一緒に直す。
  `skip` は「やらない」の逃げ場なので消さない。
- `BATCH_SIZE` は 20。増やすとリクエスト数は減るが 1 回の応答が長くなり `maxDuration`（60 秒）に当たる。
  変える前に理由をユーザーに説明する。
- `route.ts` は入力を必ず検証する（`rumors` は 2000 文字で切る、`setlistSize` は 10〜35、`engine` は jev / gemini）。
  エラーは `{ error: string }` の JSON で返し、キーやスタックトレースを含めない。
- 呼び出しは Jev も Gemini も有料。動作確認は `/predict` スキルで 1 回だけ。ループや自動リトライを入れない。
