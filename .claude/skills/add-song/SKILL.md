---
name: add-song
description: lib/songs.ts の曲マスタに Mrs. GREEN APPLE の曲を追加・修正する。ユーザーが「曲を足して」「この曲が無い」「タイアップを直して」と言ったとき、または採点スクリプトが「解決できない曲」を出したときに使う。
argument-hint: <曲名> [アルバム] [年] [補足]
allowed-tools: Read, Edit, Grep, Bash(npm run typecheck), Bash(grep *)
---

# 曲を追加・修正する

対象: $ARGUMENTS

`.claude/rules/songs-data.md` の規約に従う。手順は以下。

1. **重複確認**: 曲名と想定 id で `lib/songs.ts` を grep する。既にあれば「追加」ではなく「修正」として扱い、
   変えるフィールドだけ直す。
2. **必要情報を揃える**: title / year / album / mood は必須。`album` は `ALBUM_ORDER` にある文字列か確認する。
   分からない項目（年・アルバム・タイアップ）はユーザーに聞く。推測で埋めない。ただし `mood` は迷ったら `mid` でよい。
3. **id を決める**: 規約どおり英小文字ケバブケース。既存の類似 id（`hon-to-suisei`, `kaze-to-machi` など）に揃える。
4. **正しいブロックに挿入**: `// ---- ALBUM ----` の該当ブロック内、トラック順の位置に 1 行で追加する。
   新アルバムなら新ブロックを作り、`ALBUM_ORDER` の先頭側（新しい順）にも追加する。
5. **フラグ**: `pops` は『POPS』収録曲のみ。`staple` はユーザーが「定番」と明示したときだけ。
6. **確認**: `npm run typecheck` を通す。結果として追加・変更した行をそのまま提示する。

複数曲をまとめて頼まれた場合は 1 曲ずつ上の手順を踏み、最後に typecheck を 1 回だけ実行する。
