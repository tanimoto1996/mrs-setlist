---
name: predict
description: ローカルの dev サーバー経由で Jev（--engine gemini なら Gemini）にセトリを予想させ、結果を predictions/ に JSON 保存して要約する。どちらも有料なので、ユーザーが明示的に頼んだときだけ使う。
argument-hint: [--engine jev|gemini] [--rumors "匂わせメモ"] [--size 24]
disable-model-invocation: true
allowed-tools: Bash(node --no-warnings .claude/skills/predict/scripts/*), Bash(curl -s -o /dev/null -w * http://localhost:3000/*), Bash(npm run dev*), Read
---

# Jev に予想させる

引数: $ARGUMENTS

1. **サーバー確認**: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/` が 200 でなければ、
   ユーザーに `npm run dev` を別ターミナルで起こしてもらう。自分でバックグラウンド起動する場合は、
   終わったら必ず止める。
2. **実行**（1 回だけ。失敗しても自動でリトライしない）:

   ```bash
   node --no-warnings ${CLAUDE_SKILL_DIR}/scripts/predict.ts $ARGUMENTS
   ```

   `--rumors` にはユーザーが持っている匂わせ・話題を渡す。`--size` は想定曲数（既定 24）。
   `--engine gemini` で Gemini に切り替える（既定は jev）。出力先は既定で Jev が `predictions/<今日の日付>.json`、
   Gemini が `predictions/<今日の日付>-gemini.json`。同日に複数回回すなら `--out` で名前を変える。
3. **報告**: スクリプトが出す予想セトリ（順番・スロット・見込み）をそのまま示し、
   モデル名とトークン消費量を添える。上位に来た曲の傾向（新アルバム曲の割合、定番の有無、
   opener / encore の顔ぶれ）を 3 行以内で所感として付ける。
4. `TYPESAFE_API_KEY が未設定` エラーなら、`.env.local` の存在だけを `ls` で確認する。中身は読まない。
   `GEMINI_API_KEY が未設定` なら `ls -la gemini-api-key` でサイズだけ見る（0 バイトなら空）。中身は読まない。

保存した JSON は後で `/score-setlist --predicted predictions/<date>.json` に渡して採点できる。
画像にするなら `npm run screenshot:setlist -- --in predictions/<date>.json [--engine gemini] [--full]`。
