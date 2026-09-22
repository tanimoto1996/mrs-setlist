---
paths:
  - lib/jev.ts
  - lib/event.ts
  - app/api/**
---

# Jev 連携（lib/jev.ts, lib/event.ts, app/api/**）の規約

- Jev は知識モデルではなく判断モデル。曲の知識は持っていない前提で、判断材料は
  `buildState()` に詰めたメタデータと `guidance`、`event.facts`、`rumors` だけ。予想の質はここで決まる。
- `@typesafe-ai/sdk` の `TypeSafeClient` は `TYPESAFE_API_KEY`（と任意で `TYPESAFE_BASE_URL`）を
  環境変数から読む。コードにキーを書かない。`import "server-only"` を外さない。
- 質問は `score()`（4 段階 rubric、0 始まり）と `choice()`（`SLOT_OPTIONS`）の 2 種類。
  rubric の段階数を変えたら `likelihood` の正規化（`play.score / maxLevel`）も追随させる。
- `SLOT_OPTIONS` に選択肢を足すときは `Slot` 型・`SLOT_ORDER`・`page.tsx` の表示も一緒に直す。
  `skip` は「やらない」の逃げ場なので消さない。
- `BATCH_SIZE` は 20。増やすとリクエスト数は減るが 1 回の応答が長くなり `maxDuration`（60 秒）に当たる。
  変える前に理由をユーザーに説明する。
- `route.ts` は入力を必ず検証する（`rumors` は 2000 文字で切る、`setlistSize` は 10〜35）。
  エラーは `{ error: string }` の JSON で返し、キーやスタックトレースを含めない。
- 呼び出しは有料。動作確認は `/predict` スキルで 1 回だけ。ループや自動リトライを入れない。
