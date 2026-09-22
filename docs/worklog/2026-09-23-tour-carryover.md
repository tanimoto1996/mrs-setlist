# 直近ツアーの演奏曲と、ツアー間の持ち越し率を集計して Jev の前提と画面に出す

- 日付: 2026-09-23
- 依頼 / 目的: 「直近4回程度のライブでやった曲などを確認して、重複をするのか？今回はどうなのか？も考慮必要じゃない？
  前回やったやつもあるかもしれないけど、傾向的にどうなの？その辺りも含めて、セトリを考えさせないとダメだよ」

## 結論（数字）

setlist.fm 全期間（`data/setlists-history.json`）の 15 曲以上のワンマン公演 63 件を 9 ツアーにまとめ、連続する 8 組を比べた。

| 前のツアー → 次のツアー | 持ち越し（次の曲のうち前にもあった） | 新顔（復活 / 初登場） |
| --- | --- | --- |
| NOAH no HAKOBUNE → Atlantis | 8 / 21 = 38% | 13（0 / 13） |
| Atlantis → The White Lounge（FC） | 4 / 15 = 27% | 11（3 / 8） |
| The White Lounge → ゼンジン未到 銘銘編 | 3 / 26 = 12% | 23（11 / 12） |
| ゼンジン未到 銘銘編 → Harmony | 7 / 19 = 37% | 12（5 / 7） |
| Harmony → SEOUL 2025 | 7 / 18 = 39% | 11（9 / 2） |
| SEOUL 2025 → FJORD | 10 / 23 = 44% | 13（4 / 9） |
| FJORD → BABEL no TOH | 8 / 23 = 35% | 15（7 / 8） |
| BABEL no TOH → ゼンじん未到 間奏編 | 7 / 25 = 28% | 18（13 / 5） |

- **持ち越しは平均 32%（中央値 36%、12〜44%）**。前回ツアー「ゼンじん未到とイ/ミュータブル 〜間奏編〜」の 25 曲のうち
  SHADOWS に残るのは **8 曲前後（3〜11 曲）** が目安。外れる側は平均 68%。
- 新顔の **45% は 1〜2 ツアー空けた過去曲の復活**。「前回やらなかった＝今回もやらない」ではない。
- **連続して演奏されている曲は残りやすい**: 前のツアーで連続 3 ツアー以上だった曲は **76%** が次も演奏された。連続 2 ツアーは 39%、
  連続 1 ツアーだけの曲は 23%。直近 5 ツアー全部で演奏されたのは **ライラック / ANTENNA / Magic**（コロンブスは 4 / 5）。
- 前回の FC 限定ツアー **The White Lounge（19 公演・平均 16 曲）** は直前ツアーからの持ち越し 27%、演奏曲の 80% が `staple` 以外。
  FC ツアーでは定番の外の曲が入りやすい。

## やったこと

- **曲マスタに 5 曲追加** `lib/songs.ts`: 直近ツアーの常連なのに候補に無かった曲。出典は下の「判断したこと」。
  コロンブス（2024、直近 2 年で 36 回演奏）/ ア・プリオリ（2018、22 回）/ Stardom（2020、6 回）/ ツキマシテハ・The White Lounge（2024、FC ツアーの曲）。
  ローマ字エイリアス（Columbus / A Priori / Tsukimashiteha）を `lib/song-title.ts` に足した。
- **メドレー表記の突合** `lib/song-title.ts` の `resolveSetlistTitle()`: "BFF / Variety" のような表記を " / " で分けて両方の曲に数える。
  `build-song-stats` / `build-album-debut-stats` / `build-tour-stats` の 3 スクリプトで共用。
  `lib/song-stats.json` を再生成（マッチ 67 / 131 曲、未マッチは "Yume de Aimashou" 1 件だけ）。
- **ツアー名マスタ** `lib/tours.ts`: setlist.fm は tour 名が空の公演が多い（NOAH no HAKOBUNE、The White Lounge、FJORD など）ので、
  日付範囲 → 正式名称・FC 限定フラグの対応を置いた。名称の出典は Wikipedia「Mrs. GREEN APPLE」（2026-09-23 参照）。
- **集計スクリプト** `scripts/build-tour-stats.ts` → `lib/tour-stats.json`（`npm run build:tour-stats`）:
  公演をツアーにまとめ（KNOWN_TOURS → setlist.fm の tour 名 → 45 日ギャップ）、連続ツアー間の持ち越し / 外れ / 新顔（復活・初登場）、
  前のツアーでの連続回数別の持ち越し率、曲ごとの直近 5 ツアー出場状況（`playedIn` / `streak` / `toursSinceLastPlayed`）を書き出す。
- **読み出し** `lib/tour-stats.ts`: 型・`TOUR_STATS`・`recentTours()`・`projectCarriedSongs()`（持ち越し率 × 前回の曲数）。
- **Jev / Gemini の前提** `lib/jev.ts`: `buildTourHistory()` が `state.tourHistory` を作り、guidance に 3 行を生成
  （持ち越し率と目安曲数 / 連続している曲は残りやすい・全ツアー演奏の 3 曲は最有力 / FC ツアーは定番の外が入りやすい）。
  曲ごとに `recentTours` を付けた。定性的だった「playCount が高く lastPlayed が新しい曲は次のツアーでも演奏されやすい」は削り、
  「phase1 かつ staple でない曲は FC ツアーであっても演奏頻度は低い」は The White Lounge の実績（80% が staple 以外）と矛盾するので
  「普段は低いが FC ツアーでは掘り起こされることがある」に変えた。Gemini は `buildState()` を共有しているので同じ前提。
- **画面** `app/page.tsx`: New Album Odds の下に「Tour Carryover」カード（平均持ち越し率、前回ツアーから残る曲数の目安、
  ツアー組ごとの行、連続回数別の率、全ツアー演奏曲、FC ツアーの注記）。Library のクイックフィルタに「前回ツアー」を追加。
- **E2E** `smoke.spec.ts` に Tour Carryover の表示と「前回ツアー」フィルタのテストを 1 本追加。`fixtures.ts` に `ui.carryover`。
- **ドキュメント**: README（新セクション）/ CLAUDE.md（コマンド・構成）/ docs/e2e.md / rules（jev, ui, songs-data）/ tune-jev SKILL。

## 判断したこと・理由

- **直近「4 回程度」は 5 ツアーにした**: 直近 4 本だと SEOUL 2025（2 公演・海外）までで、直近のアリーナ長期公演 Harmony が入らない。
  SHADOWS はアリーナの FC ツアーなので Harmony を含めた 5 本を `playedIn` の対象にした。`RECENT_TOURS` の 1 定数。
- **曲はツアー単位で見る**（公演単位ではなく）: 同じツアーの公演はほぼ同じセトリなので、公演単位で比べると「重複率 100%」ばかりになる。
- **目安は「持ち越し率 × 前回の延べ曲数」**: 次のツアーの曲のうち前のツアーにもあった割合を、次も同規模と仮定して前回の曲数に掛けた。
  レンジは min〜max（12〜44%）で、下限 3 曲は「16 曲の FC ツアー → 26 曲のスタジアム」という規模差の大きい組が作っている。平均 8 曲を主に渡している。
- **曲の追加の出典**: コロンブス = 2024 年シングル（英語版 Wikipedia のディスコグラフィ）。ア・プリオリ = 2018-08-01 配信（歌ネット / レコチョク）。
  Stardom = 2020 年配信シングル（Apple Music）。ツキマシテハ・The White Lounge = 『The White Lounge in CINEMA - Original Soundtrack』
  （2024-09-23、Apple Music / USEN encore）で音源化。タイアップは確認できなかったので書いていない。`mood` は迷ったので `mid`（コロンブスだけ `up`）。
- **ツアー名は Wikipedia の表記**: setlist.fm の "ZENJI MITO TO IM/MUTABLE" ではなく「ゼンじん未到とイ/ミュータブル 〜間奏編〜」。
  `from` / `to` は setlist.fm にある公演の範囲であって全日程ではない（`lib/tours.ts` のコメントに明記）。
- Harmony は Wikipedia の記述では FC 限定と確認できなかったので `fanClubOnly: false`。

## 確認したこと

- `npm run build:tour-stats` の出力（上の表）。未マッチは "scenario"（曲マスタに無い）と空文字 1 件だけ。
- `npm run build:stats` / `npm run build:album-stats` を再実行（曲追加とメドレー対応の反映）。
- `npm run typecheck` 通過。
- `lib/jev.ts` の `buildState()` を Node で直接呼んで guidance の文面と `songs[].recentTours` を目視。20 曲バッチの state は約 14 KB（tourHistory は 2.2 KB）。
- `npm run test:e2e`（引数なし・フル）: **44 本通過・2 本 skip（幅で片方だけのテスト）、6.6 分**。desktop 23 + mobile 23。
  1 回目は gemini.spec の desktop 3 本が hydration 待ち（15 秒）で落ちたが、dev サーバーの初回コンパイルに当たったもので、温まった 2 回目は全部通った。
  この記録を追記した後にもう一度フルで回し、その tree で push している。
- `npm run build` 通過。

## 残課題・引き継ぎ

- **Jev / Gemini の予想は取り直していない**（有料）。前提が大きく変わったので `/predict` で 1 回取り、前回の予想と
  「前回ツアーの曲が何曲入ったか」「ライラック / ANTENNA / Magic が入っているか」を比べるとよい。
- setlist.fm 側にあって曲マスタに無い曲: "scenario"（Phase 1）、"夢で逢いましょう"（1 回）。
- `lib/tours.ts` の FC 限定フラグは The White Lounge だけ。Harmony が FC 限定だった出典が見つかれば `fanClubOnly: true` にして再集計する。
- ツアー間の比較は「1 回でも演奏したか」なので、公演ごとの日替わり枝（ゼンじん未到 間奏編は 6 公演で延べ 25 曲）は区別していない。
