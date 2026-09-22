---
name: find-skills
description: ユーザーが「Xってどうやるの」「Xのスキルある？」「Xできる？」と聞いたとき、あるいはエージェントの能力を広げたい（デザイン・テスト・デプロイなど特定領域の助けが欲しい）と言ったときに、オープンなエージェントスキル エコシステム（skills.sh / npx skills）からスキルを探して導入する。探している機能がインストール可能なスキルとして存在しそうなら使う。
argument-hint: <探したいこと（例: ui design, e2e testing, changelog）>
allowed-tools: Bash(npx skills *), Bash(npx -y skills*), WebFetch, Read, Write, Glob
---

# スキルを探す

対象: $ARGUMENTS

このスキルは、オープンなエージェントスキル エコシステムからスキルを見つけて導入するためのもの。
元ネタは [vercel-labs/skills の find-skills](https://skills.sh/vercel-labs/skills/find-skills)。

## いつ使うか

ユーザーが次のようなことを言ったとき:

- 「X ってどうやるの」（X が、既にスキルがありそうな一般的な作業）
- 「X のスキルを探して」「X できるスキルある？」
- 「X できる？」（X が専門的な能力）
- エージェントの能力を広げたい、と興味を示した
- ツール・テンプレート・ワークフローを探したい
- 特定領域（デザイン、テスト、デプロイなど）で助けが欲しいとこぼした

## Skills CLI とは

Skills CLI（`npx skills`）は、オープンなエージェントスキル エコシステムのパッケージマネージャ。
スキルは、専門知識・ワークフロー・ツールでエージェントの能力を拡張するモジュール式のパッケージ。

**主なコマンド:**

- `npx skills find [query] [--owner <owner>]` … キーワードで検索（GitHub の owner で絞り込みも可）
- `npx skills add <package>` … GitHub などからスキルを導入
- `npx skills update` … 導入済みスキルをまとめて更新

**一覧はここ:** https://skills.sh/

## 手順

### 1. 何が必要かを掴む

依頼から次の 3 点を特定する。

1. 領域（React、テスト、デザイン、デプロイ など）
2. 具体的な作業（テストを書く、アニメーションを作る、PR をレビューする など）
3. スキルが既に存在していそうなくらい一般的な作業か

### 2. まずリーダーボードを見る

CLI で検索する前に [skills.sh のリーダーボード](https://skills.sh/) を確認し、その領域で定番のスキルが
無いかを見る。リーダーボードは総インストール数順なので、よく使われて実績のあるものが上に来る。

例えば Web 開発の上位は:

- `vercel-labs/agent-skills` … React / Next.js / Web デザイン（各 10 万インストール超）
- `anthropics/skills` … フロントエンドデザイン、ドキュメント処理（10 万インストール超）

### 3. 検索する

リーダーボードで見つからなければ find を回す。

```bash
npx skills find [query] [--owner <owner>]
```

例:

- 「React アプリを速くしたい」 → `npx skills find react performance`
- 「PR レビューを手伝って」 → `npx skills find pr review`
- 「changelog を作りたい」 → `npx skills find changelog`

### 4. 勧める前に品質を確かめる

**検索結果だけを根拠に勧めない。** 必ず次を確認する。

1. **インストール数** … 1K 以上を優先。100 未満は慎重に。
2. **提供元の信頼性** … 公式系（`vercel-labs`、`anthropics`、`microsoft`）は無名の作者より信頼できる。
3. **GitHub のスター数** … 元リポジトリを見る。100 スター未満のリポジトリのスキルは疑ってかかる。

### 5. ユーザーに候補を示す

見つかったスキルは次の情報を添えて示す。

1. スキル名と何をしてくれるか
2. インストール数と提供元
3. 導入コマンド
4. skills.sh の詳細ページへのリンク

例:

```
使えそうなスキルがあった。「react-best-practices」は Vercel Engineering による
React / Next.js のパフォーマンス最適化ガイドライン。（185K インストール）

導入するなら:
npx skills add vercel-labs/agent-skills@react-best-practices

詳しく: https://skills.sh/vercel-labs/agent-skills/react-best-practices
```

### 6. 導入する

ユーザーが進めたいと言ったら、代わりに導入してよい。

```bash
npx skills add <owner/repo@skill> -g -y
```

`-g` はグローバル（ユーザー単位）導入、`-y` は確認プロンプトを飛ばす。

**このリポジトリでの方針:** プロジェクトに入れるスキルは `-g` を付けず、`.claude/skills/<name>/SKILL.md`
に **日本語で** 置く。英語のスキルをそのまま symlink するのではなく、内容をこのプロジェクトの規約
（`CLAUDE.md`、`.claude/rules/`）に合わせて日本語で書き直し、元 URL を冒頭に残す。
コード識別子・コマンドは英語のまま。

## よくあるカテゴリ

| カテゴリ | 検索語の例 |
| --- | --- |
| Web 開発 | react, nextjs, typescript, css, tailwind |
| テスト | testing, jest, playwright, e2e |
| DevOps | deploy, docker, kubernetes, ci-cd |
| ドキュメント | docs, readme, changelog, api-docs |
| コード品質 | review, lint, refactor, best-practices |
| デザイン | ui, ux, design-system, accessibility |
| 生産性 | workflow, automation, git |

## 検索のコツ

1. **具体的な語を使う** … 「testing」より「react testing」
2. **言い換えてみる** … 「deploy」で出なければ「deployment」「ci-cd」
3. **定番の提供元を見る** … 多くは `vercel-labs/agent-skills` や `ComposioHQ/awesome-claude-skills` にある

## 見つからなかったとき

1. 該当するスキルが無かったことを正直に伝える
2. 自分の一般能力でそのまま手伝うと申し出る
3. よくやる作業なら `npx skills init` で自作できると案内する

例:

```
「xyz」に関するスキルを探したが、該当は無かった。
このまま直接手伝える。進めていい？

よくやる作業なら、自分のスキルとして作っておくこともできる:
npx skills init my-xyz-skill
```
