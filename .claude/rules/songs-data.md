---
paths:
  - lib/songs.ts
---

# 曲マスタ（lib/songs.ts）の規約

- 1 曲 1 行、`s(id, title, year, album, mood, extra?)` ヘルパーで書く。オブジェクトリテラル直書きはしない。
- `id` は英小文字ケバブケース。日本語タイトルはヘボン式ローマ字（例: `natsu-no-kage`）。
  英語タイトルは小文字化してスペースをハイフンに（例: `brand-new`）。記号は落とす（`lulu.` → `lulu`）。
- `id` は全体で一意。追加前に `grep -n '"<id>"' lib/songs.ts` で重複確認する。
- `album` は `ALBUM_ORDER` に含まれる文字列と完全一致させる。新アルバムを足すときは `ALBUM_ORDER` にも追加し、
  リリース順が新しいものを上に置く。シングル曲・配信曲は `"single"`。
  フルアルバムなら `lib/albums.ts` の `FULL_ALBUMS` に発売日と正式な収録曲 `tracks`（id の配列）も足す。
  `album` は「最初に収録されたアルバム」（例: StaRt は Variety）なので、再収録曲は `tracks` にだけ現れる。
- アルバム収録曲・発売日は出典（Wikipedia、レーベルの商品ページ、公式サイト）で確認してから書く。記憶で書かない。
  確認した出典は worklog に残す（2026-09-23 の照合: `docs/worklog/2026-09-23-album-history-sources.md`）。
- setlist.fm 側がローマ字（"Ao to Natsu"）で登録している曲は `lib/song-title.ts` の `SONG_TITLE_ALIASES` に
  別表記 → id を足す。`songs.ts` の title 自体は日本語の正式表記のまま。
  メドレー表記（"BFF / Variety"）はエイリアスにしない。`resolveSetlistTitle()` が " / " で分けて 1 曲ずつ突合する。
- `era` は `year` から自動算出（2022 以降が phase2）。手で指定しない。
- `mood` は `up` / `mid` / `ballad` の 3 値。迷ったら `mid`。
- `staple`（ライブ定番）は主観フラグ。ユーザーが明示したときだけ付ける。勝手に付けない。
- `pops` はアルバム『POPS』（2026-09-30）収録曲だけ `true`。
- `tieup` は「媒体『作品名』役割」の形式で短く（例: `TVアニメ『葬送のフリーレン』第2期 OP`）。
  CM や番組テーマソングのように作品名が無いものは『』を省き「企業名 商品名 CM」「番組名 テーマソング」の形にする。
  役割（主題歌 / 挿入歌 / OP / ED / CM）は省略しない。補足は括弧でなく役割の後ろに続ける（例: `主題歌（セルフカバー）`）。
- 並び順はアルバムごとのブロックを保ち、ブロック内はトラック順。ブロック見出しコメント `// ---- ALBUM ----` を残す。
- 変更後は `npm run typecheck` を通す。
