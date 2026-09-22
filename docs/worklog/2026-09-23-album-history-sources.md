# Phase 1 のアルバム直後ツアーを公開情報で補い、曲マスタのアルバム振り分けを出典で直す

- 日付: 2026-09-23
- 依頼 / 目的: New Album Odds で TWELVE / Mrs. GREEN APPLE / ENSEMBLE / Attitude が「setlist.fm にツアーのデータ無し」だったことに対し、
  「これ取得して、突合できないの？ なければネットの情報からでも取得できると思うけど、嘘はつかないでよ、わからなければわからないでいいが」

## 結論（数字）

| アルバム | 発売 | 初日 | 新譜曲 | ツアー平均 | 出典 |
| --- | --- | --- | --- | --- | --- |
| TWELVE | 2016-01-13 | 2016-03-01 千葉LOOK | 10 / 15 = 67%（先行 1/2、初出 9/11） | 2 公演 63% | ファンブログ（初日）、Fanplus（ファイナル 4/10） |
| Mrs. GREEN APPLE | 2017-01-11 | 2017-03-01 CLUB CITTA'川崎 | 9 / 18 = 50%（先行 4/5、初出 5/8） | 2 公演 50% | LiveFans（3/1, 3/2。5/19 ファイナルは 120 日を超えるので集計外） |
| ENSEMBLE | 2018-04-18 | 2018-05-12 パルテノン多摩 | 10 / 22 = 46%（先行 4/7、初出 6/6） | 4 公演 45% | LiveFans（5/12, 5/19, 5/26, 7/15）。幕張 9/8, 9/9 は Billboard JAPAN だが 120 日超で集計外 |
| Attitude | 2019-10-02 | 2019-12-07 横浜アリーナ | 12 / 23 = 52%（先行 4/5、初出 8/12） | 3 公演 52% | LiveFans（12/7, 12/8, 1/23）。12/7 の曲順は LiveFans・もとりょこblog・やわろっくで食い違うので `orderReliable=false` |
| ANTENNA | 2023-07-05 | 2023-07-08 さいたまSA | 8 / 24 = 33%（先行 4/4、初出 4/9） | 8 公演 35% | setlist.fm |

- **平均 50%、直近の ANTENNA は 33%**。初期は「アルバムツアー」で新譜が 6〜7 割、持ち曲が増えた活動再開後は 3 割強、という下降トレンド。
- POPS（24 曲）の目安は **8〜12 曲**（直近比率〜平均）。Jev には「現在の状況は直近の比率に近い」と添えて渡す。
- ANTENNA の 8/24 は前回と同じ数字だが中身が違う（前回は songs.ts の誤ったアルバム振り分けで ダンスホール・ニュー・マイ・ノーマル を
  ANTENNA 曲として数えていた。正しくは 私は最強・ケセラセラ が ANTENNA 曲）。

## 分からなかったこと・やらなかったこと

- TWELVE ツアーの 3/1 千葉LOOK のセトリは LiveFans に未登録で、参加者のファンブログ 1 件が出典。公式のセトリではない。
  梅田 CLUB QUATTRO 3/28 のレポート（ガクシンFind）は本文の言及順しか無いのでセトリとして採用していない。
- 横浜アリーナ 2019-12-07 の曲順は 3 つの出典で違う（曲の集合は LiveFans と もとりょこblog で一致。やわろっく は 青と夏 が無い 22 曲）。
  曲の集合だけを信用し、曲順は使っていない（この集計は曲順を使わない）。
- 「scenario」（2023 NOAH no Hakobune で 6 回）、「救出論」（2018 未発表曲）、「ツキマシテハ」「ア・プリオリ」「SwitCh」「未発表曲」は
  曲マスタに無いまま。新譜曲ではないので比率には影響しない。
- POPS の収録曲は発売前で出典照合できない。`songs.ts` の `pops` フラグ（公式発表ベース）をそのまま `lib/albums.ts` に写し、
  ずれたら集計スクリプトが警告する。

## 曲マスタ（lib/songs.ts）の修正 — 出典で照合した収録曲

照合元:
- TWELVE: ユニバーサル ミュージック商品ページ https://www.universal-music.co.jp/mrsgreenapple/products/upch-20411/ と公式ストア https://mga-officialstore.com/products/upch20411
- Mrs. GREEN APPLE / ENSEMBLE / Attitude / ANTENNA / Progressive / Variety / Unity: 日本語版 Wikipedia の各アルバム記事

直したこと:
- **TWELVE**（13 曲）: 実際は 愛情と矛先 / Speaking / パブリック / 藍 / キコリ時計 / 私 / No.7 / ミスカサズ / SimPle / InTerLuDe ～白い朝～ / Hug / HeLLo / 庶幾の唄。
  songs.ts にあった 我逢人・StaRt・VIP・リスキーゲーム・道徳と皿 はミニアルバム Progressive / Variety の曲、恋と吟・umbrella は TWELVE 未収録。
  キコリ時計 / 私 / No.7 / SimPle / InTerLuDe / HeLLo を追加、Speaking（2017→2016）・Hug（2018→2016）を TWELVE に移動。
- **Mrs. GREEN APPLE**（13 曲）: Lion / おもちゃの兵隊 / 絶世生物 / うブ / FACTORY / JOURNEY を追加。umbrella を移動。
  Speaking・SimPathy・CONNECTED・WHOO WHOO WHOO・どこかで日は昇る・They are は未収録（WHOO / どこかで / They are は ENSEMBLE へ）。
- **ENSEMBLE**（13 曲）: はじまり (feat. キヨサク from MONGOL800) / On My MiND を追加。スマイロブドリーマ・Coffee を Attitude から移動。
  アンゼンパイ・ナニヲナニヲ（Progressive）、Hug（TWELVE）、Soup（Attitude）、点描の唄・春愁・光のうた（未収録 → single）を外す。
- **Attitude**（17 曲）: InsPirATioN / How-to を追加。月とアネモネ・灯火・秘密 は未収録 → single。
- **ANTENNA**（13 曲）: アンラブレス / 橙 / BFF を追加、ケセラセラ・私は最強 を single から移動。
  ダンスホール・ブルーアンビエンス・ニュー・マイ・ノーマル・延々・Part of me は Unity（2022 ミニアルバム）へ、フロリジナル は single。
- **Unity**（2022-07-08、6 曲）: 君を知らない を追加。アボイドノート・Theater・PRESENT（2020 の配信曲）は Unity ではないので single。
- **Variety**（2015、6 曲）を `ALBUM_ORDER` に追加: StaRt / リスキーゲーム / L.P / VIP / ゼンマイ / 道徳と皿（L.P・ゼンマイ を追加）。
- **Progressive**（2015、6 曲）: 我逢人 / ナニヲナニヲ / CONFLICT / アンゼンパイ / 日々と君 / WaLL FloWeR（CONFLICT・日々と君・WaLL FloWeR を追加）。
  曲マスタにあった「Progressive」という曲は収録曲に無いので削除。
- Ke-Mo Sabe → 公式表記 **Ke-Mo Sah-Bee** に直した（id は `ke-mo-sabe` のまま）。
- `year` は最初の収録アルバムの発売年に合わせた（VIP など 2016→2015）。`era` は自動計算なので影響なし。
- **未確認のまま残したもの**: `connected`（"CONNECTED" 2017）。出典が見つからず、Progressive の CONFLICT の誤記の可能性がある。
  TODO コメントを付けて single に置いた。ユーザーに確認したい。
- 新しく足した曲の `mood` は規約どおり `mid`、`staple` は付けていない、`tieup` は分からないので書いていない。
- 曲数 102 → 126。id の重複なし、`ALBUM_ORDER` 漏れなし（Node で確認）。

## 仕組みの変更

- `lib/albums.ts`: `FULL_ALBUMS[].tracks`（正式な収録曲の id）を追加。集計は `songs.ts` の `album` ではなくこちらを見る
  （StaRt のように複数アルバムに入る曲を正しく扱うため）。songs.ts に無い id があればスクリプトが止まる。
- `data/manual-setlists.json`: 手入力セトリ 14 公演。1 公演ごとに `url` / `source` / `orderReliable`。
  `build-album-debut-stats.ts` が setlist.fm と合わせて読む（同じ日付・会場が両方にあれば setlist.fm 優先）。
  `song-stats.json`（曲別実績）には使わない。
- `lib/album-stats.ts`: 目安を `expectedLow〜expectedHigh`（直近比率 × 曲数 〜 平均比率 × 曲数）のレンジに。
  `AlbumShowStats.source` / `sourceNote`、`AlbumTourStats.sources`、`summary.latestFirstShowShare` を追加。
- `lib/jev.ts`: guidance を「平均 50%、直近 ANTENNA 33%。8〜12 曲、現在の状況は直近寄り」に。
  `newAlbumHistory.measured[].firstShow.source` で setlist.fm / manual を区別できる。
- `app/page.tsx`: New Album Odds に 5 枚の実績行、手入力の行には「出典」リンク、平均と直近の 2 つの %、目安レンジ。
- `lib/song-title.ts`: 新しく足した曲のローマ字エイリアス（Zessei Seibutsu / Omocha no Heitai / Ubu / Unloveless / Daidai / Kimi wo Shiranai /
  Zenmai / Watashi / Hibi to Kimi / Kikoridokei）。`build:stats` の未マッチが コロンブス・アプリオリ・Stardom・メドレー表記 だけになった。
- E2E: smoke の New Album Odds テストを「TWELVE も初日の % を出し、出典リンクを持つ」に更新。

## 確認したこと

- `npm run build:album-stats` の出力（上の表）。`npm run typecheck` 通過。Playwright MCP でカードを目視。
- `npm run test:e2e`（引数なし・フル）: **42 本通過・2 本 skip（幅で片方だけのテスト）、5.0 分**。この記録を追記した後にもう一度フルで回し、その tree で push している。

## 残課題・引き継ぎ

- `connected`（CONNECTED）の正体を確認したい。CONFLICT の誤記なら `/add-song` で削除する。
- 曲マスタに無いまま演奏回数が多い曲: コロンブス（36 回）、ア・プリオリ（22 回）、Stardom（6 回）。いずれもフルアルバム未収録の配信曲。
  `/add-song` で年・タイアップを確認して足すか判断してほしい。
- 手入力セトリの出典はファンブログ 1 件（TWELVE 初日）を含む。公式に近い出典（ライブレポート媒体）が見つかれば差し替える。
- 2017 の MGA MEET YOU TOUR は 20 公演すべて LiveFans にセトリがあるが、3 公演だけ取り込んだ。ツアー平均の精度を上げるなら足せる。
