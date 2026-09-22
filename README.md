# SHADOWS セトリ予想 — Jev vs 俺

Mrs. GREEN APPLE の全曲から、Ringo Jam Tour "SHADOWS" 香川初日 (2026/09/30) の
セットリストを当てる遊び。自分で予想を組んで、TypeSafe の判断モデル **Jev** にも
同じ前提で予想させ、ライブ後に実セトリを入れて採点する。

## 仕組み

- `lib/songs.ts` … 曲マスタ（年・アルバム・タイアップ・ムード・定番フラグ・POPS 収録）
- `lib/event.ts` … 公演の前提（ツアー名、初日＝アルバム発売日、会場など）
- `lib/jev.ts` … 20 曲ずつバッチにして Jev に fan-out。曲ごとに
  - `Score`：演奏される見込み（4 段階 rubric → 0〜1 に正規化）
  - `Choice`：序盤 / 中盤 / アンコール / やらない
  を聞き、上位 N 曲を slot 順に並べて予想セトリにする
- `lib/scoring.ts` … 曲一致 10 点、順番 ±2 で +5、1 曲目・ラスト曲的中で各 +15
- `app/api/predict/route.ts` … API キーはサーバ側だけ。フロントには渡さない

Jev は知識モデルじゃなくて判断モデルなので、state に詰めたメタデータと
「匂わせメモ」だけを材料に判断する。メタデータの質＝予想の質。

## 過去ライブの演奏実績（setlist.fm）

曲マスタだけだと Jev の材料が薄いので、setlist.fm の公式 API から直近 2 年分のセトリを取り、
曲ごとの演奏回数・最終演奏日・1 曲目率・アンコール率・平均位置を `lib/song-stats.json` に集計して
state の `songs[].stats` に載せている。

```bash
# https://api.setlist.fm/docs/1.0/index.html でキーを発行し .env.local に SETLISTFM_API_KEY=... を書く
npm run fetch:setlists   # → data/setlists.json（生 JSON は data/raw/setlistfm/ にキャッシュ。--refresh で再取得）
npm run build:stats      # → lib/song-stats.json。突合できなかった曲名を「未マッチ一覧」で出す
```

- 1 リクエスト 1 秒以上あける。HTML スクレイピングはしない。
- SE や Tape（`isTape=true`）は集計しない。
- 未マッチの曲名は `lib/song-title.ts` の正規化ルールか `lib/songs.ts` の表記を直して再集計する。
  スクリプトが `songs.ts` を勝手に書き換えることはない。

## 動かす

```bash
npm install
cp .env.example .env.local   # TYPESAFE_API_KEY を入れる
npm run dev
```

キーは https://console.typesafe.ai/keys で発行。
OpenRouter 経由にするなら `TYPESAFE_BASE_URL=https://openrouter.ai/api` と
OpenRouter のキーを `TYPESAFE_API_KEY` に入れる。

## デプロイ

Vercel にそのまま載る。環境変数 `TYPESAFE_API_KEY` を設定するだけ。
Route Handler の `maxDuration` を 60 秒にしてあるので、Hobby プランでも全曲分の
バッチが収まる想定（102 曲 / 20 曲 ≒ 6 リクエスト並列）。

## 曲データについて

手作業で起こしたので抜け・誤りは普通にある。`lib/songs.ts` を直して PR ください。
`staple`（ライブ定番）は完全に主観。
