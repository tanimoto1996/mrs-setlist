// PreToolUse(Bash):
//  1) `git push` なら、E2E を通した tree と HEAD の tree が一致するかを照合し、違えば止める（exit 2）
//  2) それ以外のコマンドは、実行前の作業ツリーの tree hash を控える（post-tool.mjs が変化を検知するため）
import { E2E_OK, headTreeHash, readMarker, workingTreeHash, writeMarker } from "../../scripts/lib/git-tree.mjs";
import { readHookInput, treeSnapshotMarker } from "./_lib.mjs";

const input = await readHookInput();
const command = String(input.tool_input?.command ?? "");

/**
 * コマンドの先頭、または ; && || | 改行 の直後に来る `git push` だけを対象にする。
 * 文字列全体を見ると、コミットメッセージや grep の引数に「git push」と書いただけで誤検知する。
 * 引用符の中までは追わない（誤検知側に倒れる分には安全）。
 */
const isGitPush = (cmd) => /(^|[;&|]\s*|\n\s*)git\s+push\b/.test(cmd);

try {
  if (isGitPush(command)) {
    const tested = readMarker(E2E_OK);
    const head = headTreeHash();
    if (!tested) {
      fail(
        "E2E ゲート未通過。`npm run test:e2e` を引数なしで通してから push する。" +
          "（E2E が通ると .claude/tmp/e2e-ok に tree hash が記録され、HEAD と一致したときだけ push できる）",
      );
    }
    if (tested !== head) {
      fail(
        `E2E を通した内容（tree ${tested.slice(0, 12)}）と push しようとしている HEAD（tree ${head.slice(0, 12)}）が違う。` +
          " E2E の後に変更やコミットが入ったか、変更の一部しかコミットしていない。" +
          " 全部コミットしてから、もう一度 `npm run test:e2e` → `git push` の順でやり直す。",
      );
    }
  } else {
    writeMarker(treeSnapshotMarker(input), workingTreeHash());
  }
} catch (e) {
  // hook 内部のエラーで作業を止めない（push ゲートの判定は fail() で exit 済み）
  console.error(`[pre-bash hook] ${e instanceof Error ? e.message : e}`);
}

function fail(reason) {
  console.error(`[push ゲート] ${reason}`);
  process.exit(2);
}
