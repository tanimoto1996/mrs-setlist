// `npm run test:e2e` の実体。
// Playwright を回し、全部通ったら「この作業ツリーは E2E 済み」の印（.claude/tmp/e2e-ok）に tree hash を書く。
// git push の前に .claude/hooks/pre-bash.mjs がこの印と HEAD の tree を照合する。
// 引数付き（絞り込み・--headed など）で走らせたときは印を更新しない。フルで通したときだけが push の根拠になる。
import { spawnSync } from "node:child_process";
import { E2E_OK, removeMarker, workingTreeHash, writeMarker } from "./lib/git-tree.mjs";

const args = process.argv.slice(2);
const before = workingTreeHash();

const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const run = spawnSync(npx, ["playwright", "test", ...args], { stdio: "inherit" });
const status = run.status ?? 1;

if (status !== 0) {
  removeMarker(E2E_OK);
  console.error("\n[e2e-gate] E2E が落ちたので push ゲートを閉じた。直してからもう一度 `npm run test:e2e`。");
} else if (args.length > 0) {
  console.log("\n[e2e-gate] 引数付きの実行なので push ゲートは更新しない。push 前に引数なしの `npm run test:e2e` を通すこと。");
} else if (workingTreeHash() !== before) {
  removeMarker(E2E_OK);
  console.error("\n[e2e-gate] テスト中に作業ツリーが変わった。もう一度 `npm run test:e2e`。");
  process.exit(1);
} else {
  writeMarker(E2E_OK, before);
  console.log(`\n[e2e-gate] 全部通った。tree ${before.slice(0, 12)} を push 可として記録。`);
}

process.exit(status);
