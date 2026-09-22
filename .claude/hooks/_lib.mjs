// hook 共通: stdin の JSON を読む。失敗しても hook 自体は落とさない（exit 0 で素通り）。
export async function readHookInput() {
  try {
    let raw = "";
    for await (const chunk of process.stdin) raw += chunk;
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function sessionId(input) {
  return String(input.session_id ?? "unknown").replace(/[^a-zA-Z0-9_-]/g, "");
}

/** このセッションでリポジトリを変更した印 */
export function sessionMarker(input) {
  return `touched-${sessionId(input)}`;
}

/** Bash 実行前の作業ツリー tree hash の控え */
export function treeSnapshotMarker(input) {
  return `tree-${sessionId(input)}`;
}
