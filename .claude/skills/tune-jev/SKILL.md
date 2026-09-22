---
name: tune-jev
description: Jev の予想精度を上げるために lib/jev.ts の guidance / rubric / state や lib/event.ts の facts を調整し、変更前後の予想を比較する。「Jev の予想が微妙」「新曲を重視させたい」「前提を足したい」と言われたときに使う。
argument-hint: <直したい傾向や足したい前提>
allowed-tools: Read, Edit, Grep, Bash(npm run typecheck), Bash(node --no-warnings .claude/skills/predict/scripts/*), Bash(ls predictions*), Bash(curl -s -o /dev/null -w * http://localhost:3000/*)
---

# Jev のチューニング

要望: $ARGUMENTS

Jev は判断モデル。曲の知識は無く、`buildState()` のメタデータ・`guidance`・`event.facts`・`rumors` だけで判断する。
つまり「Jev に知ってほしいこと」は全部 state に書く必要がある。`.claude/rules/jev.md` を守る。

## 調整の当たり所

| 症状 | 触る場所 |
| --- | --- |
| 特定の傾向（新曲多め、定番軽視など）を強めたい・弱めたい | `lib/jev.ts` の `guidance` 配列。1 項目 1 主張で短く |
| 公演固有の事実を足したい | `lib/event.ts` の `facts`。確度の高い事実だけ。憶測は `rumors` に |
| 新アルバム曲の目安曲数がずれている | `lib/jev.ts` の `newAlbumGuidance()` の文言、`scripts/build-album-debut-stats.ts` のルール（120 日 / 15 曲）、または `data/manual-setlists.json` に出典付きで公演を足す → `npm run build:album-stats`。JSON は手で触らない |
| setlist.fm の実績が 0 回になっている曲がある | `npm run build:stats` の未マッチ一覧を見て `lib/song-title.ts` の `SONG_TITLE_ALIASES` に別表記を足す。曲マスタに無い曲なら `/add-song` |
| 曲ごとの判断材料が足りない | `buildState().songs` に渡すフィールドを増やす（`Song` 型に追加 → `songs.ts` にデータ） |
| 見込みの段階が粗い・偏る | `PLAY_LEVELS` の文言・段階数。段階数を変えたら正規化も直す |
| スロットの分け方が合わない | `SLOT_OPTIONS`（`Slot` 型・`SLOT_ORDER`・`page.tsx` も追随） |

## 手順

1. 現状の予想を確認する。`predictions/` に今日の JSON があればそれを基準にする。無ければ
   ユーザーに了承を得てから `/predict` の手順で 1 回取る（有料）。
2. 上の表に沿って **1 つの仮説につき 1 箇所** だけ変える。同時に複数変えると効果が切り分けられない。
3. `npm run typecheck` を通す。
4. ユーザーに了承を得てから `--out predictions/<date>-after.json` で予想を 1 回取り直す。
5. 前後の `setlist` を並べて差分（入った曲・抜けた曲・順番の移動）を示し、狙った方向に動いたかを判定する。
   動いていなければ変更を戻すか、別の仮説を提案する。勝手に何度も回さない。
