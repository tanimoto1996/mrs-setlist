# SHADOWS セトリ予想 — Jev vs Gemini vs 俺

Mrs. GREEN APPLE の全曲から、Ringo Jam Tour "SHADOWS" 香川初日 (2026/09/30) の
セットリストを当てる遊び。自分で予想を組んで、TypeSafe の判断モデル **Jev** にも
同じ前提で予想させ、ライブ後に実セトリを入れて採点する。Jev の精度を測る比較対象として、
Google の **Gemini** にも同じ前提・同じ物差しで予想させられる。

## 仕組み

- `lib/songs.ts` … 曲マスタ（年・アルバム・タイアップ・ムード・定番フラグ・POPS 収録）
- `lib/event.ts` … 公演の前提（ツアー名、初日＝アルバム発売日、会場など）
- `lib/jev.ts` … 20 曲ずつバッチにして Jev に fan-out。曲ごとに
  - `Score`：演奏される見込み（4 段階 rubric → 0〜1 に正規化）
  - `Choice`：序盤 / 中盤 / アンコール / やらない
  を聞き、上位 N 曲を slot 順に並べて予想セトリにする
- `lib/gemini.ts` … 同じ state・同じ rubric を Gemini（`generateContent` + JSON スキーマ）に全曲 1 リクエストで渡し、
  Jev と同じ `PredictionResult` に正規化する。Gemini は曲の知識も持つので「state を主に、知識は補助」と指示
- `lib/scoring.ts` … 曲一致 10 点、順番 ±2 で +5、1 曲目・ラスト曲的中で各 +15。俺 / Jev / Gemini の 3 者で勝敗
- `app/api/predict/route.ts` … `engine: "jev" | "gemini"` で切り替え。API キーはサーバ側だけ。フロントには渡さない

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
  setlist.fm の古い登録はローマ字（"Que Sera Sera" / "Dance Hall"）なので、`SONG_TITLE_ALIASES` に別表記 → id を足す。
  スクリプトが `songs.ts` を勝手に書き換えることはない。

## フルアルバムが出た直後のライブで、新譜曲は何割か

「アルバム発売日のツアー初日だから新曲が多いはず」を感覚で渡すと Jev の予想が回ごとにぶれるので、数字にして渡している。

```bash
npm run fetch:setlists:history   # setlist.fm の全期間 → data/setlists-history.json
npm run build:album-stats        # → lib/album-debut-stats.json（アルバムごとの初日・ツアー平均の新譜曲比率を標準出力にも出す）
```

- 対象は `lib/albums.ts` のフルアルバム（TWELVE / Mrs. GREEN APPLE / ENSEMBLE / Attitude / ANTENNA / POPS）。
- 「発売直後のツアー」= 発売日から 120 日以内で、演奏曲 15 曲以上の公演（フェス・TV 出演は除く）。
- 収録曲は「先行シングル（発売前に演奏実績あり）」と「アルバム初出」に分けて数える。
- setlist.fm に Phase 1（2016〜2020）のワンマン公演がほぼ登録されていないため、いま測れているのは
  **ANTENNA → 2023-07-08 さいたまスーパーアリーナ初日: 24 曲中 8 曲（33%）、ツアー 8 公演平均 32%** だけ。
  この 33% を `lib/jev.ts` の `buildState()` が `newAlbumHistory` と guidance（「POPS 曲は 8 曲前後」）として Jev / Gemini に渡し、
  画面の New Album Odds カードにも同じ数字を出す。

## Gemini と比べる

```bash
# https://aistudio.google.com/apikey でキーを発行し、.env.local に GEMINI_API_KEY=... を書く
# （またはプロジェクトルートの gemini-api-key ファイルにキーだけを 1 行書く。gitignore 済み）
# モデルを変えるなら GEMINI_MODEL=...（カンマ区切りで複数可。既定は gemini-3.8-flash → 3.7 → 3.6 → 3.5 の順に試し、混雑 503・上限 429 なら次へ）
```

画面の「Gemini に予想させる」を押すと、Jev のカードの下に Gemini の予想が並ぶ。Library のチップには
Jev（緑）と Gemini（青）の見込み % が両方出て、Result は俺 / Jev / Gemini の 3 者で採点される。

### 予想を JSON・画像で残す

各カードの「JSON を保存」で予想を `PredictionResult` の JSON としてダウンロードできる。
`predictions/` に置いて次のコマンドを回すと、そのカードの見た目そのままの PNG になる（API は呼ばない）。

```bash
npm run screenshot:setlist -- --in predictions/2026-09-23.json                  # Jev のカードだけ
npm run screenshot:setlist -- --in predictions/2026-09-23-gemini.json --engine gemini --full  # ページ全体
```

## 動かす

```bash
npm install
cp .env.example .env.local   # TYPESAFE_API_KEY を入れる
npm run dev
```

キーは https://console.typesafe.ai/keys で発行。
OpenRouter 経由にするなら `TYPESAFE_BASE_URL=https://openrouter.ai/api` と
OpenRouter のキーを `TYPESAFE_API_KEY` に入れる。

## テスト（E2E）と作業の流れ

画面の振る舞いは Playwright の E2E（`e2e/`）で担保する。Jev の API はテストでは必ずモックする（本物は有料）。

```bash
npm run test:e2e       # フル実行。dev サーバーが 3000 で動いていればそれを使う
npm run test:e2e:ui    # UI モードでデバッグ
```

ローカルではシステムの Google Chrome を使う（macOS 12 では Playwright 同梱の Chromium が入らないため）。
実装したら **ドキュメント・作業記録（`docs/worklog/`）→ typecheck → E2E → commit → push** の順で締める。
E2E を通していない内容の `git push` は Claude Code の hook が止める。詳細は `docs/workflow.md` と `docs/e2e.md`。

## デプロイ

Vercel にそのまま載る。環境変数 `TYPESAFE_API_KEY`（Gemini も使うなら `GEMINI_API_KEY`）を設定するだけ。
Route Handler の `maxDuration` を 60 秒にしてあるので、Hobby プランでも全曲分の
バッチが収まる想定（102 曲 / 20 曲 ≒ 6 リクエスト並列）。

## 曲データについて

手作業で起こしたので抜け・誤りは普通にある。`lib/songs.ts` を直して PR ください。
`staple`（ライブ定番）は完全に主観。
