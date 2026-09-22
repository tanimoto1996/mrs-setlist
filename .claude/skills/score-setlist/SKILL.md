---
name: score-setlist
description: ライブ後に実セトリを入力して、俺の予想と Jev の予想を lib/scoring.ts のルールで採点する。「答え合わせ」「採点して」「実セトリはこれ」と言われたときに使う。
argument-hint: [--predicted predictions/<date>.json] [--mine mine.txt]
allowed-tools: Bash(node --no-warnings .claude/skills/score-setlist/scripts/*), Write, Read, Bash(mkdir -p .claude/tmp), Bash(ls predictions*)
---

# セトリを採点する

引数: $ARGUMENTS

採点ルール（`lib/scoring.ts`）: 曲一致 10 点、順番が ±2 以内なら +5、1 曲目的中 +15、ラスト曲的中 +15。

1. **実セトリを受け取る**: ユーザーから曲名の並び（本編＋アンコール、演奏順）を聞く。
   1 行 1 曲で `.claude/tmp/actual.txt` に書く（番号付きでも可、スクリプトが剥がす）。
2. **予想側を決める**:
   - Jev: `--predicted` が無ければ `ls predictions/` で直近の JSON を選び、ユーザーに確認する。
   - 俺の予想: 画面の localStorage にしかないので、ユーザーに並びを貼ってもらい `.claude/tmp/mine.txt` に書く。
     貼ってもらえなければ Jev だけ採点する。
3. **実行**:

   ```bash
   node --no-warnings ${CLAUDE_SKILL_DIR}/scripts/score.ts --actual .claude/tmp/actual.txt [--predicted ...] [--mine ...]
   ```

4. **解決できない曲が出たら**: スクリプトが候補を出す。表記ゆれ（全角半角、ピリオド、英字大小）なら
   `actual.txt` を直す。本当に曲マスタに無い曲なら `/add-song` で追加してから再実行する。
5. **報告**: 点数の内訳を俺 vs Jev で並べ、取りこぼした曲を示す。どちらが勝ったかを 1 行で。
