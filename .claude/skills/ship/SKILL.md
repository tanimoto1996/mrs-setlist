---
name: ship
description: 実装が一段落したら必ず通す締めのフロー。作業記録とドキュメントの更新 → typecheck → E2E（Playwright、フル）→ commit → push を順に行い、E2E が通らなければ push しない。「push して」「仕上げて」「出して」と言われたとき、Stop フックに促されたとき、あるいは自分でコードを変えた作業を終えるときに使う。
argument-hint: [コミットメッセージの要旨（省略可）]
allowed-tools: Read, Edit, Write, Glob, Grep, Bash(git status*), Bash(git diff*), Bash(git log*), Bash(git add *), Bash(git commit *), Bash(git push*), Bash(git rev-parse*), Bash(git rev-list*), Bash(git branch*), Bash(npm run typecheck), Bash(npm run build), Bash(npm run test:e2e*), Bash(npx playwright *)
---

# 締める（ドキュメント → E2E → push）

要旨: $ARGUMENTS

「実装したら必ず E2E を通し、通ったら push する」を機械的にやる手順。全体像は `docs/workflow.md`。
順番を入れ替えない。E2E を飛ばして push しようとしても hook（`.claude/hooks/pre-bash.mjs`）に弾かれる。

## 0. 変更の棚卸し

```bash
git status
git diff --stat
```

- 自分がこのセッションで触っていないファイルの変更が混ざっていたら、それはユーザーの作業。**add しない**で報告に含める。
- `.env*` / `jev-api-key` / `predictions/*.json` は中身を読まない。誤って add しない。

## 1. ドキュメントと作業記録（必須）

1. `docs/worklog/YYYY-MM-DD-<slug>.md` を作る（同じ作業の続きなら追記）。テンプレは `docs/workflow.md`。
   「何を・なぜ・どう変えたか」「確認方法」「残課題」を書く。
2. 今回の変更で古くなった記述を直す: `README.md` / `CLAUDE.md` / `docs/*.md` / `.claude/rules/*.md` / 各 `SKILL.md`。
   コマンドを足したら `CLAUDE.md` の「コマンド」表に、スキルを足したら「スキル」表に。
3. UI（`app/**`）や API を変えたなら、対応する E2E を `e2e/` に追加・更新（`.claude/rules/e2e.md`）。
   新しい画面状態を作ったのにテストが無い、は不可。

## 2. 型と E2E

```bash
npm run typecheck
npm run test:e2e
```

- `test:e2e` は**引数なし**で。絞り込み実行（`-g`、ファイル指定）は push の根拠にならない。
- dev サーバーが 3000 で動いていればそれを使う。動いていなければ Playwright が自分で `next dev` を上げる。
- 落ちたら: 出力の `Error:` と `error-context.md` を読んで原因を直し、再実行。**最大 3 周**。
  それでも通らなければ push せず、落ちたテスト名・原因の見立て・試したことを報告して終わる。
  テストを消したり `test.skip` で黙らせたりしない（仕様が変わってテストが古くなった場合だけ直す）。
- `/api/predict` を本物で呼ぶテストは書かない。有料。

## 3. commit → push

```bash
git add <触ったファイルを列挙>
git commit -m "<日本語で 1 行。何を・なぜ>" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
git push
```

- E2E を通した後にファイルを 1 つでも変えたら、`npm run test:e2e` からやり直す（hook が tree hash の不一致で止める）。
- `git push --force` は禁止（deny 済み）。
- push が hook に止められたら、理由を読んで「2.」に戻る。印を手で書いてすり抜けない。

## 4. 報告

箇条書きで:

- 変えたもの（ファイル単位ではなく意味単位で）
- 作業記録のパス
- E2E の結果（通ったテスト数 / 所要時間）
- push したコミット（`git log --oneline -1`）
- 残課題・ユーザーに判断してほしいこと
