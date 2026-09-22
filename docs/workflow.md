# 作業の流れ（実装 → ドキュメント → E2E → push）

このリポジトリでコードを変えたら、**必ず**次の順で締める。人が手でやっても Claude Code がやっても同じ。
Claude Code では `/ship` スキルがこの手順そのもの。

```
実装
 └→ ① ドキュメント・作業記録を書く（docs/worklog/、README / CLAUDE.md / docs/ の更新）
     └→ ② npm run typecheck
         └→ ③ npm run test:e2e   … Playwright をフルで。通ると「push 可」の印が付く
             └→ ④ git commit
                 └→ ⑤ git push   … ③で通した内容と HEAD が一致しないと hook が止める
```

## なぜこの順か

- **ドキュメントが先**: 後回しにすると書かれない。「何を・なぜ」を書く過程で抜けにも気付く。
- **E2E が push の前**: 画面は `app/page.tsx` 1 ファイルに集中していて、小さな変更でも別の場所を壊しやすい。
  push されたものは常に「E2E が通った状態」だと保証したい。
- **commit の後にもう一度触ったらやり直し**: テストした中身と push する中身がずれないように、
  tree hash（ファイル内容全体のハッシュ）で照合している。

## 機械的に強制しているもの（`.claude/settings.json` の hooks）

| タイミング | スクリプト | やること |
| --- | --- | --- |
| Bash 実行前 | `.claude/hooks/pre-bash.mjs` | `git push` なら `.claude/tmp/e2e-ok` の tree hash と `HEAD^{tree}` を照合。違えば push を止める。それ以外のコマンドは実行前の tree hash を控える |
| Edit / Write / Bash 実行後 | `.claude/hooks/post-tool.mjs` | リポジトリの中身が変わっていたら「このセッションで触った」印を立てる |
| 応答を終えるとき | `.claude/hooks/stop-gate.mjs` | 触った印があり、未コミット / 未 push が残っていれば一度だけ止めて `/ship` を促す |

- 印はすべて `.claude/tmp/`（gitignore 済み）。手で書き換えてすり抜けない。
- `npm run test:e2e`（`scripts/e2e-gate.mjs`）が引数なしで全部通ったときだけ `e2e-ok` を更新する。
  `-g` やファイル指定で絞った実行、`test:e2e:ui` / `test:e2e:headed` は印を更新しない。
- Stop hook はユーザー自身の未コミット変更だけなら止めない（Claude が触った印が無いため）。
- hook の設定は起動時に読み込まれる。`settings.json` を変えたら Claude Code を起動し直す（または `/hooks` で確認）。

## 作業記録（docs/worklog/）の書き方

ファイル名は `YYYY-MM-DD-<slug>.md`。同じ日に別の作業をしたら slug を変える。テンプレ:

```markdown
# <作業の一言タイトル>

- 日付: YYYY-MM-DD
- 依頼 / 目的: なぜやったか（ユーザーの言葉をそのまま引用してよい）

## やったこと
- 意味単位で箇条書き（ファイル名は補助）

## 判断したこと・理由
- 迷った選択肢と、選んだ理由

## 確認したこと
- typecheck / E2E の結果（テスト数・所要時間）、手で見たこと

## 残課題・引き継ぎ
- やらなかったこと、ユーザーに判断してほしいこと
```

## E2E が通らないとき

1. 出力の `Error:` と `test-results/<テスト名>/error-context.md`（失敗時の画面のアクセシビリティツリー）を読む。
2. `npm run test:e2e:ui` か `npx playwright show-trace test-results/<...>/trace.zip` で動きを見る。
3. 直す → `npm run test:e2e`。**3 周やっても通らなければ push しない**で、状況を報告する。
4. テストを消す・`test.skip` で黙らせるのは禁止。仕様変更でテストが古くなったときだけ、期待値を直す。

## よくある質問

- **ドキュメントだけ直したときも E2E がいる？** いる。例外を作ると崩れるので、1〜2 分待つ。
- **push だけしたいのに hook に止められた**: 「E2E を通した後に何か変えた」か「一部しかコミットしていない」。
  `git status` で確認し、全部コミットしてから `npm run test:e2e` → `git push`。
- **hook を一時的に外したい**: 外さない。どうしても必要なら `.claude/settings.json` の `hooks` を編集し、その理由を worklog に書く。
