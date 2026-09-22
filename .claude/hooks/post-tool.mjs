// PostToolUse(Edit|Write|MultiEdit|NotebookEdit|Bash):
// このセッションでリポジトリの中身を変えたら .claude/tmp/touched-<session> を立てる。
// Bash は pre-bash.mjs が控えた tree hash と比べて、変化があったときだけ「触った」扱いにする
// （git status や cat だけの Bash では立てない）。stop-gate.mjs がこの印を見る。
import { readMarker, removeMarker, workingTreeHash, writeMarker } from "../../scripts/lib/git-tree.mjs";
import { readHookInput, sessionMarker, treeSnapshotMarker } from "./_lib.mjs";

const input = await readHookInput();

try {
  let touched = true;
  if (input.tool_name === "Bash") {
    const before = readMarker(treeSnapshotMarker(input));
    removeMarker(treeSnapshotMarker(input));
    touched = before !== null && before !== workingTreeHash();
  }
  if (touched) writeMarker(sessionMarker(input), new Date().toISOString());
} catch (e) {
  console.error(`[post-tool hook] ${e instanceof Error ? e.message : e}`);
}
