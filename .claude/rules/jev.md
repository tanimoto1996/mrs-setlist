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
