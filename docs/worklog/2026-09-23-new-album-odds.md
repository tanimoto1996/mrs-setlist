# フルアルバム発売直後のライブで新譜曲が占める割合を集計し、Jev の前提と画面に出す

- 日付: 2026-09-23
- 依頼 / 目的: 「フルアルバムが出た時のミセスの次のライブで歌う確率は何%なの？ 今回、Pops が出たからそこからライブで歌う曲が
  多くなるのかも含めて予測させたい。その確率も、どこかに出しておいてほしい。それを含めて、シャドーズの予測をさせないとぶれすぎると思う」

## 結論（数字）

- setlist.fm で測れたのは **ANTENNA（2023-07-05 発売）→ 3 日後のアリーナツアー初日 2023-07-08 さいたまスーパーアリーナ** だけ。
  - 初日: 24 曲中 **8 曲 = 33%** が ANTENNA 収録曲（先行シングル 4/6、アルバム初出 4/8）
  - ツアー 8 公演（〜2023-08-13 ベルーナドーム）平均: 23.25 曲中 7.5 曲 = **32%**。収録 14 曲のうち 10 曲が 1 回でも演奏
- POPS に当てると **24 曲中 約 8 曲**。収録 16 曲 = 先行シングル 7（Brand New / GOOD DAY / lulu. / 風と町 / Carrying Happiness /
  夏の影 / Variety。全部演奏実績あり）＋ アルバム初出 9。
- TWELVE / Mrs. GREEN APPLE / ENSEMBLE / Attitude は、setlist.fm に Phase 1 のワンマン公演がほぼ登録されておらず測れない
  （フェスと TV 出演しか無い）。画面と state では「データ無し」と明示している。

## やったこと

- **全期間のセトリ取得**: `npm run fetch:setlists:history`（`scripts/fetch-setlists.ts --since 2015-01-01 --out data/setlists-history.json`）。
  setlist.fm 上の Mrs. GREEN APPLE は 164 公演（9 ページ）。既存の `data/setlists.json`（直近 2 年、Jev の曲別実績用）はそのまま。
- **ローマ字エイリアス** `lib/song-title.ts`: setlist.fm の登録が "Que Sera Sera" / "Dance Hall" / "Ao to Natsu" のようにローマ字のものが多く、
  `normalizeSongTitle()` だけでは日本語タイトルに突合できていなかった。`SONG_TITLE_ALIASES`（41 件）と `buildTitleIndex()` を足し、
  `build-song-stats` / `build-album-debut-stats` の両方で使う。
  **副産物として `lib/song-stats.json` が大きく変わった**: ライラック 0 回 → 45 回、ケセラセラ 0 → 25、ダーリン 0 → 23、
  インフェルノ・青と夏・ダンスホールなども 0 だった。これまで Jev はこれらの定番曲を「演奏実績なし」で見ていた。
- **アルバムマスタ** `lib/albums.ts`: フルアルバム 6 枚の発売日。ミニアルバムは対象外。
- **集計スクリプト** `scripts/build-album-debut-stats.ts` → `lib/album-debut-stats.json`（`npm run build:album-stats`）:
  発売日から 120 日以内・演奏 15 曲以上の公演を「発売直後のツアー」とし、初日とツアー平均の新譜曲比率、
  収録曲を「先行シングル（発売前に演奏実績あり or 発売年より前）」と「アルバム初出」に分けた内訳、曲ごとの演奏率を出す。
  発売日がデータの最終日より後のアルバム（POPS）は `upcoming` として先行曲の内訳だけ出す。
- **読み出し** `lib/album-stats.ts`: 型・`ALBUM_DEBUT_STATS`・`projectNewAlbumSongs(album, setlistSize)`（初日比率 × 曲数）。
  サーバーと画面の両方から使うので `server-only` にしていない（キーも含まない）。
- **Jev / Gemini の前提** `lib/jev.ts` / `lib/event.ts`: `EventContext.newAlbum`（"POPS"）を足し、`buildNewAlbumHistory()` が
  `state.newAlbumHistory`（ルール・計測できたアルバムの初日とツアー・データ無しのアルバム・この公演の目安）を作る。
  guidance の「新アルバム収録曲は多めに演奏される傾向がある」（定性的）を、
  「過去実績では 33%、この公演では 8 曲前後を基準。全部入れる・ほとんど外すのどちらにも寄せない」
  「先行シングルは 67%、アルバム初出は 50% が初日に演奏された。先行を優先し初出は半分程度に絞る」の 2 行に置き換えた。
  `songs[].albumTrackType`（`pre-released` / `album-only` / null）も足した。Gemini は `buildState()` を共有しているので同じ前提になる。
- **画面** `app/page.tsx`: rail の先頭に「New Album Odds」カード。初日比率（33%）、POPS から約 8 曲 / 24 曲の目安、
  アルバムごとの実績行（データ無しは明示）、先行シングルの一覧、「Jev と Gemini の前提にも渡している」の注記。
- **E2E**: `smoke.spec.ts` に New Album Odds の表示（見出し・目安の文・ANTENNA の行・TWELVE のデータ無し）を 1 本追加。`fixtures.ts` に `ui.odds`。
- **ドキュメント**: README（新セクション）/ CLAUDE.md（コマンド・構成）/ docs/e2e.md / rules（jev, songs-data, ui）/ tune-jev SKILL。
  `.playwright-mcp/` を gitignore に追加。

## 判断したこと・理由

- **Phase 1 のアルバムを手入力で補わない**: 2016〜2019 のツアー初日セトリを記憶で書くと間違える。setlist.fm の API 以外から取らない
  （スクレイピング禁止）という既存方針も守る。画面と state で「データ無し」と出して、n=1 であることを隠さない。
- **目安は「初日の比率」を使う**（ツアー平均ではなく）: SHADOWS の予想対象がツアー初日で、ANTENNA のときも初日が最も新譜曲が多かった。
  両方 JSON に入れているので、切り替えは `projectNewAlbumSongs()` の 1 行。
- **既存の `data/setlists.json`（直近 2 年）は残す**: 曲別実績（playCount / lastPlayed）は「最近やっているか」を見るためのものなので、
  全期間を混ぜると意味が変わる。全期間は別ファイル `data/setlists-history.json` にした。
- **エイリアスは songs.ts に無い曲には付けない**: "Watashi"（私）/ "HeLLo" / "Columbus" などは曲マスタ自体に無い。
  追加は `/add-song` でユーザーと確認しながらやる（下の残課題）。
- **guidance は数字入りの文を生成する**: Jev は state の数字を自分で読み解くとは限らないので、結論（8 曲前後）を文にして渡す。
  JSON を再集計すると文も追随する。

## 確認したこと

- `npm run build:album-stats` の出力（上の結論のとおり）。`npm run build:stats` の未マッチ一覧が「曲マスタに無い曲」だけになった。
- `npm run typecheck` 通過。
- Playwright MCP で画面を開いて New Album Odds カードを目視（Jev / Gemini のボタンは押していない）。
- `npm run test:e2e`（引数なし・フル）: **42 本通過・2 本 skip（幅で片方だけのテスト）、4.5 分**。desktop 22 + mobile 22。
  この記録を追記した後にもう一度フルで回し、その tree で push している。

## 残課題・引き継ぎ

- **曲マスタに無い曲が setlist.fm 側にある**（直近 2 年の演奏回数）: コロンブス 36、アプリオリ 22、君を知らない 14、おもちゃの兵隊 12、
  アンラブレス 12、ゼンマイ 12、絶世生物 12、CONFLICT 6、Stardom 6、BFF 6（Variety とのメドレー表記）、No.7 2、WaLL FloWeR 2、
  夢で逢いましょう 1。特にコロンブス・アプリオリ・君を知らないは Jev の候補にすら入っていない。`/add-song` で足すか判断してほしい。
  Phase 1 期にも 私 / HeLLo / scenario / L.P / 橙 / SimPle / 毎日 などが未登録。
- Jev の予想は今回取り直していない（有料）。前提が変わったので、`/predict` で 1 回取って、前回の予想と新譜曲の数を比べるとよい。
  ANTENNA 1 枚しか根拠が無いので、初日の実セトリが出たら `lib/albums.ts` はそのまま、`fetch:setlists:history` → `build:album-stats` で
  POPS も measured に変わる（n=2 になる）。
